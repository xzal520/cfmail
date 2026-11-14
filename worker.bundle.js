// node_modules/hono/dist/http-exception.js
var HTTPException = class extends Error {
  res;
  status;
  /**
  * Creates an instance of `HTTPException`.
  * @param status - HTTP status code for the exception. Defaults to 500.
  * @param options - Additional options for the exception.
  */
  constructor(status = 500, options) {
    super(options?.message, { cause: options?.cause });
    this.res = options?.res;
    this.status = status;
  }
  /**
  * Returns the response object associated with the exception.
  * If a response object is not provided, a new response is created with the error message and status code.
  * @returns The response object.
  */
  getResponse() {
    if (this.res) return new Response(this.res.body, {
      status: this.status,
      headers: this.res.headers
    });
    return new Response(this.message, { status: this.status });
  }
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  return new Response(arrayBuffer, { headers: { "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase()) } }).formData();
};

// node_modules/hono/dist/utils/body.js
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const mediaType = (isRawRequest(request) ? request.headers : request.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return parseFormData(request, {
    all,
    dot
  });
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) return convertFormDataToBodyData(await request.bodyCache.formData, options);
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) request.bodyCache.formData = formDataPromise;
  const formData = await formDataPromise;
  if (formData) return convertFormDataToBodyData(formData, options);
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key) => {
    if (!(options.all || key.endsWith("[]"))) form[key] = value;
    else handleParsingAllValues(form, key, value);
  });
  if (options.dot) Object.entries(form).forEach(([key, value]) => {
    if (key.includes(".")) {
      handleParsingNestedValues(form, key, value, nestingState);
      delete form[key];
    }
  });
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) form[key].push(value);
    else form[key] = [form[key], value];
  } else if (!key.endsWith("[]")) form[key] = value;
  else form[key] = [value];
};
var handleParsingNestedValues = (form, key, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key)) return;
  let nestedForm = form;
  const keys = key.split(".", 34);
  if (keys.length > 33) throwNestingLimitExceeded();
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) nestedForm[key2] = value;
    else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) throwNestingLimitExceeded();
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var throwNestingLimitExceeded = () => {
  throw new Error("Nesting limit exceeded");
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") paths.shift();
  return paths;
};
var splitRoutingPath = (routePath2) => {
  const { groups, path } = extractGroupsFromPath(routePath2);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match3, index) => {
    const mark = `@${index}`;
    groups.push([mark, match3]);
    return mark;
  });
  return {
    groups,
    path
  };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) if (paths[j].includes(mark)) {
      paths[j] = paths[j].replace(mark, groups[i][1]);
      break;
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") return "*";
  const match3 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match3) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match3[2]) patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [
        cacheKey,
        match3[1],
        new RegExp(`^${match3[2]}(?=/${next})`)
      ] : [
        label,
        match3[1],
        new RegExp(`^${match3[2]}$`)
      ];
      else patternCache[cacheKey] = [
        label,
        match3[1],
        true
      ];
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match3) => {
      try {
        return decoder(match3);
      } catch {
        return match3;
      }
    });
  }
};
var decodeURIWithPreservedPercent = (value) => decodeURI(value.includes("%25") ? value.replace(/%25/g, "%2525") : value);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      const decoded = tryDecode(path, decodeURIWithPreservedPercent);
      if (/%(?![0-9A-Fa-f]{2})/.test(path)) {
        const rewritten = new URL("http://localhost");
        rewritten.pathname = decoded.replace(/[\\\t\n\r]/g, encodeURIComponent);
        if (tryDecode(rewritten.pathname, decodeURIWithPreservedPercent) !== decoded) return tryDecode(path.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"), decodeURIWithPreservedPercent);
      }
      return decoded;
    } else if (charCode === 63 || charCode === 35) break;
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) sub = mergePath(sub, ...rest);
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
    else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") results.push("/");
        else results.push(basePath);
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else basePath += "/" + segment;
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) url = url.slice(0, hashIndex);
  let encoded;
  if (!multiple && key && !/[%+&=]/.test(key)) {
    const queryIndex = url.indexOf("?", 8);
    let keyIndex2 = queryIndex;
    if (keyIndex2 === -1) return;
    if (!url.startsWith(key, keyIndex2 + 1)) keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61 || trailingKeyCode === 38 || isNaN(trailingKeyCode)) {
        if (keyIndex2 > queryIndex && /(?:^|&)[^=&]*[%+]/.test(url.slice(queryIndex + 1, keyIndex2))) break;
        if (trailingKeyCode === 61) {
          const valueIndex = keyIndex2 + key.length + 2;
          const endIndex = url.indexOf("&", valueIndex);
          return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
        }
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) return;
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
    if (encoded) name = _decodeURI(name);
    keyIndex = nextKeyIndex;
    if (name === "") continue;
    let value;
    if (valueIndex === -1) value = "";
    else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) value = _decodeURI(value);
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) results[name] = [];
      results[name].push(value);
    } else results[name] ??= value;
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  /**
  * `.raw` can get the raw Request object.
  *
  * @see {@link https://hono.dev/docs/api/request#raw}
  *
  * @example
  * ```ts
  * // For Cloudflare Workers
  * app.post('/', async (c) => {
  *   const metadata = c.req.raw.cf?.hostMetadata?
  *   ...
  * })
  * ```
  */
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  /**
  * `.path` can get the pathname of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#path}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const pathname = c.req.path // `/about/me`
  * })
  * ```
  */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) decoded[key] = tryDecodeURIComponent(value);
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) return this.raw.headers.get(name) ?? void 0;
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) return cachedBody;
    for (const anyCachedKey in bodyCache) return bodyCache[anyCachedKey].then((body) => {
      if (anyCachedKey === "json") body = JSON.stringify(body);
      const contentType = anyCachedKey === "formData" ? void 0 : raw2.headers.get("content-type");
      return new Response(body, { headers: contentType ? { "Content-Type": contentType } : void 0 })[key]();
    });
    return bodyCache[key] = raw2[key]();
  };
  /**
  * `.json()` can parse Request body of type `application/json`
  *
  * @see {@link https://hono.dev/docs/api/request#json}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.json()
  * })
  * ```
  */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
  * `.text()` can parse Request body of type `text/plain`
  *
  * @see {@link https://hono.dev/docs/api/request#text}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.text()
  * })
  * ```
  */
  text() {
    return this.#cachedBody("text");
  }
  /**
  * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
  *
  * @see {@link https://hono.dev/docs/api/request#arraybuffer}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.arrayBuffer()
  * })
  * ```
  */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
  * `.bytes()` parses the request body as a `Uint8Array`.
  *
  * @see {@link https://hono.dev/docs/api/request#bytes}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.bytes()
  * })
  * ```
  */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
  * Parses the request body as a `Blob`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.blob();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#blob
  */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
  * Parses the request body as `FormData`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.formData();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#formdata
  */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
  * Adds validated data to the request.
  *
  * @param target - The target of the validation.
  * @param data - The validated data to add.
  */
  addValidatedData(target, data) {
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
  * `.url` can get the request url strings.
  *
  * @see {@link https://hono.dev/docs/api/request#url}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const url = c.req.url // `http://localhost:8787/about/me`
  *   ...
  * })
  * ```
  */
  get url() {
    return this.raw.url;
  }
  /**
  * `.method` can get the method name of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#method}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const method = c.req.method // `GET`
  * })
  * ```
  */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
  * `.matchedRoutes` can return a matched route in the handler
  *
  * @deprecated
  *
  * Use matchedRoutes helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#matchedroutes}
  *
  * @example
  * ```ts
  * app.use('*', async function logger(c, next) {
  *   await next()
  *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
  *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
  *     console.log(
  *       method,
  *       ' ',
  *       path,
  *       ' '.repeat(Math.max(10 - path.length, 0)),
  *       name,
  *       i === c.req.routeIndex ? '<- respond from here' : ''
  *     )
  *   })
  * })
  * ```
  */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
  * `.routePath` can retrieve the path registered within the handler
  *
  * @deprecated
  *
  * Use routePath helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#routepath}
  *
  * @example
  * ```ts
  * app.get('/posts/:id', (c) => {
  *   return c.json({ path: c.req.routePath })
  * })
  * ```
  */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) str = str.toString();
    if (str instanceof Promise) str = await str;
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) return Promise.resolve(str);
  if (buffer) buffer[0] += str;
  else buffer = [str];
  const resStr = Promise.all(callbacks.map((c) => c({
    phase,
    buffer,
    context
  }))).then((res) => Promise.all(res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) return raw(await resStr, callbacks);
  else return resStr;
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
  * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
  *
  * @see {@link https://hono.dev/docs/api/context#env}
  *
  * @example
  * ```ts
  * // Environment object for Cloudflare Workers
  * app.get('*', async c => {
  *   const counter = c.env.COUNTER
  * })
  * ```
  */
  env = {};
  #var;
  finalized = false;
  /**
  * `.error` can get the error object from the middleware if the Handler throws an error.
  *
  * @see {@link https://hono.dev/docs/api/context#error}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   await next()
  *   if (c.error) {
  *     // do something...
  *   }
  * })
  * ```
  */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
  * Creates an instance of the Context class.
  *
  * @param req - The Request object.
  * @param options - Optional configuration options for the context.
  */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
  * `.req` is the instance of {@link HonoRequest}.
  */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#event}
  * The FetchEvent associated with the current request.
  *
  * @throws Will throw an error if the context does not have a FetchEvent.
  */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no FetchEvent");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#executionctx}
  * The ExecutionContext associated with the current request.
  *
  * @throws Will throw an error if the context does not have an ExecutionContext.
  */
  get executionCtx() {
    if (this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no ExecutionContext");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#res}
  * The Response object for the current request.
  */
  get res() {
    return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
  }
  /**
  * Sets the Response object for the current request.
  *
  * @param _res - The Response object to set.
  */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") continue;
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
        } else _res.headers.set(k, v);
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
  * `.render()` can create a response within a layout.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   return c.render('Hello!')
  * })
  * ```
  */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
  * Sets the layout for the response.
  *
  * @param layout - The layout to set.
  * @returns The layout function.
  */
  setLayout = (layout) => this.#layout = layout;
  /**
  * Gets the current layout for the response.
  *
  * @returns The current layout function.
  */
  getLayout = () => this.#layout;
  /**
  * `.setRenderer()` can set the layout in the custom middleware.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```tsx
  * app.use('*', async (c, next) => {
  *   c.setRenderer((content) => {
  *     return c.html(
  *       <html>
  *         <body>
  *           <p>{content}</p>
  *         </body>
  *       </html>
  *     )
  *   })
  *   await next()
  * })
  * ```
  */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
  * `.header()` can set headers.
  *
  * @see {@link https://hono.dev/docs/api/context#header}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *
  *   // Append multiple headers using the append option (e.g. Vary)
  *   c.header('Vary', 'Accept-Encoding', { append: true })
  *   c.header('Vary', 'User-Agent', { append: true })
  *
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  header = (name, value, options) => {
    if (this.finalized && !this.#res.bodyUsed) this.#res = createResponseInstance(this.#res.body, this.#res);
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) headers.delete(name);
    else if (options?.append) headers.append(name, value);
    else headers.set(name, value);
  };
  status = (status) => {
    this.#status = status;
  };
  /**
  * `.set()` can set the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   c.set('message', 'Hono is hot!!')
  *   await next()
  * })
  * ```
  */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
  * `.get()` can use the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   const message = c.get('message')
  *   return c.text(`The message is "${message}"`)
  * })
  * ```
  */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
  * `.var` can access the value of a variable.
  *
  * @see {@link https://hono.dev/docs/api/context#var}
  *
  * @example
  * ```ts
  * const result = c.var.client.oneMethod()
  * ```
  */
  get var() {
    if (!this.#var) return {};
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key, value] of new Headers(arg.headers)) if (key === "set-cookie") responseHeaders.append(key, value);
      else responseHeaders.set(key, value);
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) if (++count > 1 || typeof headers[k] !== "string") {
          responseHeaders = new Headers();
          break;
        }
      }
      if (responseHeaders) for (const k in headers) {
        const v = headers[k];
        if (typeof v === "string") responseHeaders.set(k, v);
        else {
          responseHeaders.delete(k);
          for (const v2 of v) responseHeaders.append(k, v2);
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
  * `.body()` can return the HTTP response.
  * You can set headers with `.header()` and set HTTP status code with `.status`.
  * This can also be set in `.text()`, `.json()` and so on.
  *
  * @see {@link https://hono.dev/docs/api/context#body}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *   // Set HTTP status code
  *   c.status(201)
  *
  *   // Return the response body
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
  * `.text()` can render text as `Content-Type:text/plain`.
  *
  * @see {@link https://hono.dev/docs/api/context#text}
  *
  * @example
  * ```ts
  * app.get('/say', (c) => {
  *   return c.text('Hello!')
  * })
  * ```
  */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  };
  /**
  * `.json()` can render JSON as `Content-Type:application/json`.
  *
  * @see {@link https://hono.dev/docs/api/context#json}
  *
  * @example
  * ```ts
  * app.get('/api', (c) => {
  *   return c.json({ message: 'Hello!' })
  * })
  * ```
  */
  json = (object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
  * `.redirect()` can Redirect, default status code is 302.
  *
  * @see {@link https://hono.dev/docs/api/context#redirect}
  *
  * @example
  * ```ts
  * app.get('/redirect', (c) => {
  *   return c.redirect('/')
  * })
  * app.get('/redirect-permanently', (c) => {
  *   return c.redirect('/', 301)
  * })
  * ```
  */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  };
  /**
  * `.notFound()` can return the Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/context#notfound}
  *
  * @example
  * ```ts
  * app.get('/notfound', (c) => {
  *   return c.notFound()
  * })
  * ```
  */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else handler = i === middleware.length && next || void 0;
      if (handler) try {
        res = await handler(context, () => dispatch(i + 1));
      } catch (err) {
        if (err instanceof Error && onError) {
          context.error = err;
          res = await onError(err, context);
          isError = true;
        } else throw err;
      }
      else if (context.finalized === false && onNotFound) res = await onNotFound(context);
      if (res && (context.finalized === false || isError)) context.res = res;
      return context;
    }
  };
};

// node_modules/hono/dist/helper/route/index.js
var matchedRoutes = (c) => c.req[GET_MATCH_RESULT][0].map(([[, route]]) => route);
var routePath = (c, index) => matchedRoutes(c).at(index ?? c.req.routeIndex)?.path ?? "";

// node_modules/hono/dist/router.js
var METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "query"
];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/utils/mount.js
var countTrailingSlashes = (path) => {
  let index = path.length;
  while (index > 0 && path.charCodeAt(index - 1) === 47) index--;
  return path.length - index;
};
var getPathPrefixLength = (c, pathPrefix, routePath2) => {
  if (!/[:*]/.test(pathPrefix)) return pathPrefix.length;
  const path = c.req.path;
  const matchResult = c.req[GET_MATCH_RESULT];
  const paramNames = /* @__PURE__ */ new Set();
  let length = 0;
  for (const part of splitRoutingPath(pathPrefix)) {
    if (part[0] === ":" && part.endsWith("}?")) throw new Error(`mount(): Optional regular expression parameters are not supported in "${routePath2}".`);
    const pattern = getPattern(part);
    if (pattern && pattern !== "*") {
      const name = pattern[1];
      if (paramNames.has(name)) throw new Error(`mount(): Duplicate path parameter "${name}" in "${routePath2}".`);
      paramNames.add(name);
    }
    if (pattern && pattern !== "*" && pattern[2] !== true) {
      const value = matchResult.length === 2 ? matchResult[1][matchResult[0][c.req.routeIndex][1][pattern[1]]] : matchResult[0][c.req.routeIndex][1][pattern[1]];
      length += value.length + 1;
    } else if (pattern || part.endsWith("*")) {
      const end = path.indexOf("/", length + 1);
      length = end === -1 ? path.length : end;
    } else length += part.length + 1;
  }
  return length;
};
var createMountedRequest = (c, pathPrefix, routePath2) => {
  if (/[^/]\*$/.test(routePath2)) throw new Error(`mount(): Wildcard must follow "/" in "${routePath2}".`);
  const prefixLength = getPathPrefixLength(c, pathPrefix, routePath2);
  const path = c.req.path.slice(prefixLength) || "/";
  if (prefixLength > c.req.path.length || path[0] !== "/" || /\/(?:\.|%2e){1,2}(?:\/|$)/i.test(path)) throw new HTTPException(400, { message: "Invalid mounted path" });
  const rawUrl = c.req.raw.url;
  if (/^[^/?#]*\/\/[^/?#\\]*[?#\\]/.test(rawUrl)) throw new HTTPException(400, { message: "Invalid mounted path" });
  const rawPathEnd = rawUrl.search(/[?#]/);
  const rawTrailingSlashes = countTrailingSlashes(rawPathEnd === -1 ? rawUrl : rawUrl.slice(0, rawPathEnd));
  if (rawTrailingSlashes > 1 && countTrailingSlashes(c.req.path) === rawTrailingSlashes - 1) throw new HTTPException(400, { message: "Invalid mounted path" });
  const url = new URL(rawUrl);
  url.pathname = path.replace(/[\\\t\n\r]/g, encodeURIComponent);
  if (path.includes("%")) {
  }
  return new Request(url, c.req.raw);
};

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class Hono2 {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    [...METHODS, "all"].forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") this.#path = args1;
        else this.#addRoute(methodName, this.#path, args1);
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) this.#addRoute(methodName, this.#path, handler);
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") this.#path = arg1;
      else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute("ALL", this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono2({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  /**
  * `.route()` allows grouping other Hono instance in routes.
  *
  * @see {@link https://hono.dev/docs/api/routing#grouping}
  *
  * @param {string} path - base Path
  * @param {Hono} app - other Hono instance
  * @returns {Hono} routed Hono instance
  *
  * @example
  * ```ts
  * const app = new Hono()
  * const app2 = new Hono()
  *
  * app2.get("/user", (c) => c.text("user"))
  * app.route("/api", app2) // GET /api/user
  * ```
  */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) handler = r.handler;
      else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
  * `.basePath()` allows base paths to be specified.
  *
  * @see {@link https://hono.dev/docs/api/routing#base-path}
  *
  * @param {string} path - base Path
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * const api = new Hono().basePath('/api')
  * ```
  */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
  * `.onError()` handles an error and returns a customized Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#error-handling}
  *
  * @param {ErrorHandler} handler - request Handler for error
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.onError((err, c) => {
  *   console.error(`${err}`)
  *   return c.text('Custom Error Message', 500)
  * })
  * ```
  */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
  * `.notFound()` allows you to customize a Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#not-found}
  *
  * @param {NotFoundHandler} handler - request handler for not-found
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.notFound((c) => {
  *   return c.text('Custom 404 Message', 404)
  * })
  * ```
  */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
  * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
  *
  * @deprecated Use `mount()` from `hono/mount` instead. `.mount()` will be removed in v5.
  *
  * @see {@link https://hono.dev/docs/api/hono#mount}
  *
  * @param {string} path - base Path
  * @param {Function} applicationHandler - other Request Handler
  * @param {MountOptions} [options] - options of `.mount()`
  * @returns {Hono} mounted Hono instance
  * @throws {Error} If automatic request rewriting encounters duplicate path parameter names or an optional regular expression parameter.
  * @throws {HTTPException} With status 400 if automatic request rewriting cannot safely preserve the routed path.
  *
  * @example
  * ```ts
  * import { Router as IttyRouter } from 'itty-router'
  * import { Hono } from 'hono'
  * // Create itty-router application
  * const ittyRouter = IttyRouter()
  * // GET /itty-router/hello
  * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
  *
  * const app = new Hono()
  * app.mount('/itty-router', ittyRouter.handle)
  * ```
  *
  * @example
  * ```ts
  * const app = new Hono()
  * // Send the request to another application without modification.
  * app.mount('/app', anotherApp, {
  *   replaceRequest: (req) => req,
  * })
  * ```
  */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") optionHandler = options;
      else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) replaceRequest = (request) => request;
        else replaceRequest = options.replaceRequest;
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    const defaultReplaceRequest = (c) => {
      const mountedRoutePath = routePath(c);
      return createMountedRequest(c, mountedRoutePath.replace(/\/?\*$/, ""), mountedRoutePath);
    };
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest ? replaceRequest(c.req.raw) : defaultReplaceRequest(c), ...getOptions(c));
      if (res) return res;
      await next();
    };
    this.#addRoute("ALL", mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) return this.errorHandler(err, c);
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
  * `.fetch()` will be entry point of your app.
  *
  * @see {@link https://hono.dev/docs/api/hono#fetch}
  *
  * @param {Request} request - request Object of request
  * @param {Env} env - env Object
  * @param {ExecutionContext} executionCtx - context of execution
  * @returns {Response | Promise<Response>} response of request
  *
  */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
  * `.request()` is a useful method for testing.
  * You can pass a URL or pathname to send a GET request.
  * app will return a Response object.
  * ```ts
  * test('GET /hello is ok', async () => {
  *   const res = await app.request('/hello')
  *   expect(res.status).toBe(200)
  * })
  * ```
  * @see https://hono.dev/docs/api/hono#request
  */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  };
  /**
  * `.fire()` automatically adds a global fetch event listener.
  * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
  * @deprecated
  * Use `fire` from `hono/service-worker` instead.
  * ```ts
  * import { Hono } from 'hono'
  * import { fire } from 'hono/service-worker'
  *
  * const app = new Hono()
  * // ...
  * fire(app)
  * ```
  * @see https://hono.dev/docs/api/hono#fire
  * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
  * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
  */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/utils.js
var createNullObject = () => /* @__PURE__ */ Object.create(null);

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match3 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers["ALL"];
    const staticMatch = matcher[2][path2];
    if (staticMatch) return staticMatch;
    const match4 = path2.match(matcher[0]);
    if (!match4) return [[], emptyParam];
    const index = match4.indexOf("", 1);
    return [matcher[1][index], match4];
  });
  this.match = match3;
  return match3(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = "[^]*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/[^]*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
  if (b.length === 1) return 1;
  if (a === "[^]*" || a === "(?:|/[^]*)") return b === "[^]*" ? -1 : 1;
  else if (b === "[^]*" || b === "(?:|/[^]*)") return -1;
  if (a === "[^/]+") return 1;
  else if (b === "[^/]+") return -1;
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class Node2 {
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context, keys) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
        "",
        "",
        ONLY_WILDCARD_REG_EXP_STR
      ] : [
        "",
        "",
        LABEL_REG_EXP_STR
      ] : null : token === "/*" ? [
        "",
        "",
        TAIL_WILDCARD_REG_EXP_STR
      ] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || "[^/]+";
        if (name && pattern[2]) {
          if (new RegExp(regexpStr).test("")) throw PATH_ERROR;
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
        }
        keys.push(regexpStr);
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== "[^]*" && regexpStr !== "(?:|/[^]*)") {
            for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== "[^]*" && k !== "(?:|/[^]*)") throw PATH_ERROR;
          }
          nextNode = node.#children[regexpStr] = new Node2();
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        keys.push(token);
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) if (k.length > 1 && k !== "[^]*" && k !== "(?:|/[^]*)") throw PATH_ERROR;
          nextNode = node.#children[token] = new Node2();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) throw PATH_ERROR;
    node.#index = index;
  }
  buildRegExpStr() {
    const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) strList.unshift(`#${this.#index}`);
    if (strList.length === 0) return "";
    if (strList.length === 1) return strList[0];
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  paths = createNullObject();
  insert(path, isStatic) {
    const keys = [];
    if (isStatic) {
      this.#root.insert(path.split(""), -1, [], this.#context, keys);
      this.paths[path] = [
        -1,
        [],
        keys
      ];
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{(?:\{[\d,]+\}|[^}])+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) break;
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./gs) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
        tokens[j] = tokens[j].replace(mark, groups[i][1]);
        break;
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, keys);
    this.paths[path] = [
      this.#index++,
      paramAssoc,
      keys
    ];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") return [
      /^$/,
      [],
      []
    ];
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [
      new RegExp(`^${regexp}`),
      indexReplacementMap,
      paramReplacementMap
    ];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
function endsWithWildcard(keys) {
  const tail = keys[keys.length - 1];
  return tail === "[^]*" || tail === "(?:|/[^]*)";
}
function covers(wildcard, target) {
  const last = wildcard.length - 1;
  for (let i = 0; i < last; i++) if (wildcard[i] !== target[i]) return false;
  return wildcard[last] === "[^]*" || target.length === last || target[last] === "/";
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #handlers;
  #tries;
  constructor() {
    this.#handlers = { ["ALL"]: [] };
    this.#tries = { ["ALL"]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const handlers = this.#handlers;
    if (!handlers) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    const tries = this.#tries;
    if (!handlers[method]) {
      tries[method] = new Trie();
      handlers[method] = [...handlers["ALL"]];
      for (const p in tries["ALL"].paths) this.#insertPath(method, p);
    }
    if (path === "/*") path = "*";
    const methods = method === "ALL" ? Object.keys(handlers) : [method];
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) for (const m of methods) {
      if (!tries[m].paths[path2]) this.#insertPath(m, path2);
      handlers[m].push([handler, path2]);
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#handlers)) matchers[method] = this.#buildMatcher(method);
    this.#handlers = this.#tries = void 0;
    return matchers;
  }
  #buildMatcher(method) {
    const handlers = this.#handlers[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    const own = createNullObject();
    const entries = handlers.map(([h, p], i) => {
      (own[p] ??= []).push(i);
      return [h, trie.paths[p][1].reduceRight((map, [key, varIndex]) => {
        map[key] = paramReplacementMap[varIndex];
        return map;
      }, createNullObject())];
    });
    const wildcards = Object.keys(own).filter((p) => endsWithWildcard(trie.paths[p][2]));
    for (const path in trie.paths) {
      const [index, , keys] = trie.paths[path];
      const indexes = [...own[path]];
      for (const p of wildcards) if (p !== path && covers(trie.paths[p][2], keys)) indexes.push(...own[p]);
      const data = indexes.sort((a, b) => a - b).map((i) => entries[i]);
      if (index === -1) {
        const last = Math.max(-1, ...data.flatMap(([, map]) => Object.values(map)));
        staticMap[path] = [data, last === -1 ? emptyParam : path.match(regexp).slice(0, last + 1)];
      } else handlerData[index] = data;
    }
    return [
      regexp,
      indexReplacementMap.map((i) => handlerData[i]),
      staticMap
    ];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    this.#routes.push([
      method,
      path,
      handler
    ]);
  }
  match(method, path) {
    if (!this.#routes) throw new Error("Fatal error");
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) router.add(...routes[i2]);
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) continue;
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) throw new Error("Fatal error");
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node3 = class Node4 {
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key] ||= new Node4();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) possibleKeys.add(pattern[1]);
    }
    curNode.#methods.push({ [method]: {
      handler,
      possibleKeys: [...possibleKeys],
      score: ++order
    } });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m["ALL"];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key = handlerSet.possibleKeys[i2];
          handlerSet.params[key] = params?.[key] && !i2 ? params[key] : nodeParams[key] ?? params?.[key];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    let curNodes = [this];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else tempNodes.push(nextNode);
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name, matcher] = pattern;
          if (!part && matcher === true) continue;
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              if (!Object.hasOwn(params, name)) params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                (curNodesQueue[componentCount] ||= []).push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            if (!Object.hasOwn(params, name)) params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) handlerSets.sort((a, b) => {
      return a.score - b.score;
    });
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node = new Node3();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) this.#node.insert(method, result, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono3 = class extends Hono {
  /**
  * Creates an instance of the Hono class.
  *
  * @param options - Optional configuration options for the Hono instance.
  */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: [
      "GET",
      "HEAD",
      "PUT",
      "POST",
      "DELETE",
      "PATCH",
      "QUERY"
    ],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") return () => optsOrigin;
      else return (origin) => optsOrigin === origin ? origin : null;
    } else if (typeof optsOrigin === "function") return optsOrigin;
    else return (origin) => optsOrigin.includes(origin) ? origin : null;
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") return async (origin, c) => (await optsAllowMethods(origin, c)).join(",");
    else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else return () => "";
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) set("Access-Control-Allow-Origin", allowOrigin);
    if (opts.credentials) set("Access-Control-Allow-Credentials", "true");
    if (exposeHeadersStr) set("Access-Control-Expose-Headers", exposeHeadersStr);
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") c.res.headers.append("Vary", "Origin");
      if (opts.maxAge != null) set("Access-Control-Max-Age", opts.maxAge.toString());
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) set("Access-Control-Allow-Methods", allowMethods);
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
      }
      if (headersStr) {
        set("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") c.header("Vary", "Origin", { append: true });
  };
};

// node_modules/postal-mime/dist/esm/decode-strings.js
var textEncoder = new TextEncoder();
var isWsp = (c) => c === 32 || c === 9;
var base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
  base64Lookup[base64Chars.charCodeAt(i)] = i;
}
function decodeBase64(base64) {
  let len = base64.length;
  while (len > 0 && base64.charAt(len - 1) === "=") {
    len--;
  }
  if (len % 4 === 1) {
    len--;
  }
  const remainder = len % 4;
  const bufferLength = Math.floor(len / 4) * 3 + (remainder ? remainder - 1 : 0);
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    let encoded1 = base64Lookup[base64.charCodeAt(i)];
    let encoded2 = base64Lookup[base64.charCodeAt(i + 1)];
    let encoded3 = base64Lookup[base64.charCodeAt(i + 2)];
    let encoded4 = base64Lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = encoded1 << 2 | encoded2 >> 4;
    if (p < bufferLength) {
      bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
    }
    if (p < bufferLength) {
      bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
    }
  }
  return arrayBuffer;
}
var charsetAliases = /* @__PURE__ */ new Map([
  // Hebrew. The logical and explicit ordering variants share the iso-8859-8 index.
  ["iso88598i", "iso-8859-8"],
  ["iso88598e", "iso-8859-8"],
  // Japanese. WHATWG shift_jis is the Windows-31J index, so cp932 text decodes
  // identically, including the NEC and IBM extension rows.
  ["shiftjis", "shift_jis"],
  ["windows31j", "shift_jis"],
  ["mskanji", "shift_jis"],
  ["eucjp", "euc-jp"],
  // ISO-2022-JP, including the -1 / -2 supersets. Escape sequences outside plain
  // ISO-2022-JP (JIS X 0212, the non-Japanese G2 sets, and the SO/SI katakana shifts
  // cp50222 uses) decode to replacement characters, but the Japanese text around them
  // still comes out right.
  ["iso2022jp", "iso-2022-jp"],
  ["iso2022jp1", "iso-2022-jp"],
  ["iso2022jp2", "iso-2022-jp"],
  ["junet", "iso-2022-jp"],
  // Korean. The WHATWG euc-kr index is the extended cp949 / UHC index.
  ["euckr", "euc-kr"],
  ["uhc", "euc-kr"],
  // Thai.
  ["tis620", "windows-874"]
]);
var codePageAliases = /* @__PURE__ */ new Map([
  ["932", "shift_jis"],
  ["936", "gbk"],
  ["949", "euc-kr"],
  ["950", "big5"],
  ["874", "windows-874"],
  // Microsoft's EUC-JP and ISO-2022-JP variants. euc-jp and iso-2022-jp cover
  // everything they can express.
  ["51932", "euc-jp"],
  ["50220", "iso-2022-jp"],
  ["50221", "iso-2022-jp"],
  ["50222", "iso-2022-jp"]
]);
var codePagePattern = /^(?:cp|windows|ms|ibm)(\d+)$/;
function normalizeCharset(charset) {
  return charset.replace(/^(?:x-ms-|x-|cs)/, "").replace(/[\s._-]+/g, "");
}
var ENCODING_LABELS = new Set([
  // UTF-8
  "unicode-1-1-utf-8 unicode11utf8 unicode20utf8 utf-8 utf8 x-unicode20utf8",
  // IBM866
  "866 cp866 csibm866 ibm866",
  // ISO-8859-2
  "csisolatin2 iso-8859-2 iso-ir-101 iso8859-2 iso88592 iso_8859-2 iso_8859-2:1987 l2 latin2",
  // ISO-8859-3
  "csisolatin3 iso-8859-3 iso-ir-109 iso8859-3 iso88593 iso_8859-3 iso_8859-3:1988 l3 latin3",
  // ISO-8859-4
  "csisolatin4 iso-8859-4 iso-ir-110 iso8859-4 iso88594 iso_8859-4 iso_8859-4:1988 l4 latin4",
  // ISO-8859-5
  "csisolatincyrillic cyrillic iso-8859-5 iso-ir-144 iso8859-5 iso88595 iso_8859-5 iso_8859-5:1988",
  // ISO-8859-6
  "arabic asmo-708 csiso88596e csiso88596i csisolatinarabic ecma-114 iso-8859-6 iso-8859-6-e",
  "iso-8859-6-i iso-ir-127 iso8859-6 iso88596 iso_8859-6 iso_8859-6:1987",
  // ISO-8859-7
  "csisolatingreek ecma-118 elot_928 greek greek8 iso-8859-7 iso-ir-126 iso8859-7 iso88597 iso_8859-7",
  "iso_8859-7:1987 sun_eu_greek",
  // ISO-8859-8
  "csiso88598e csisolatinhebrew hebrew iso-8859-8 iso-8859-8-e iso-ir-138 iso8859-8 iso88598 iso_8859-8",
  "iso_8859-8:1988 visual",
  // ISO-8859-8-I
  "csiso88598i iso-8859-8-i logical",
  // ISO-8859-10
  "csisolatin6 iso-8859-10 iso-ir-157 iso8859-10 iso885910 l6 latin6",
  // ISO-8859-13
  "iso-8859-13 iso8859-13 iso885913",
  // ISO-8859-14
  "iso-8859-14 iso8859-14 iso885914",
  // ISO-8859-15
  "csisolatin9 iso-8859-15 iso8859-15 iso885915 iso_8859-15 l9",
  // ISO-8859-16
  "iso-8859-16",
  // KOI8-R
  "cskoi8r koi koi8 koi8-r koi8_r",
  // KOI8-U
  "koi8-ru koi8-u",
  // macintosh
  "csmacintosh mac macintosh x-mac-roman",
  // windows-874
  "dos-874 iso-8859-11 iso8859-11 iso885911 tis-620 windows-874",
  // windows-1250
  "cp1250 windows-1250 x-cp1250",
  // windows-1251
  "cp1251 windows-1251 x-cp1251",
  // windows-1252
  "ansi_x3.4-1968 ascii cp1252 cp819 csisolatin1 ibm819 iso-8859-1 iso-ir-100 iso8859-1 iso88591",
  "iso_8859-1 iso_8859-1:1987 l1 latin1 us-ascii windows-1252 x-cp1252",
  // windows-1253
  "cp1253 windows-1253 x-cp1253",
  // windows-1254
  "cp1254 csisolatin5 iso-8859-9 iso-ir-148 iso8859-9 iso88599 iso_8859-9 iso_8859-9:1989 l5 latin5",
  "windows-1254 x-cp1254",
  // windows-1255
  "cp1255 windows-1255 x-cp1255",
  // windows-1256
  "cp1256 windows-1256 x-cp1256",
  // windows-1257
  "cp1257 windows-1257 x-cp1257",
  // windows-1258
  "cp1258 windows-1258 x-cp1258",
  // x-mac-cyrillic
  "x-mac-cyrillic x-mac-ukrainian",
  // GBK
  "chinese csgb2312 csiso58gb231280 gb2312 gb_2312 gb_2312-80 gbk iso-ir-58 x-gbk",
  // gb18030
  "gb18030",
  // Big5
  "big5 big5-hkscs cn-big5 csbig5 x-x-big5",
  // EUC-JP
  "cseucpkdfmtjapanese euc-jp x-euc-jp",
  // ISO-2022-JP
  "csiso2022jp iso-2022-jp",
  // Shift_JIS
  "csshiftjis ms932 ms_kanji shift-jis shift_jis sjis windows-31j x-sjis",
  // EUC-KR
  "cseuckr csksc56011987 euc-kr iso-ir-149 korean ks_c_5601-1987 ks_c_5601-1989 ksc5601 ksc_5601",
  "windows-949",
  // replacement
  "csiso2022kr hz-gb-2312 iso-2022-cn iso-2022-cn-ext iso-2022-kr replacement",
  // x-user-defined
  "x-user-defined"
].join(" ").split(" "));
var REPLACEMENT_LABELS = /* @__PURE__ */ new Set([
  "csiso2022kr",
  "hz-gb-2312",
  "iso-2022-cn",
  "iso-2022-cn-ext",
  "iso-2022-kr",
  "replacement"
]);
var replacementDecoder = {
  encoding: "replacement",
  decode: (input) => input && input.byteLength ? "\uFFFD" : ""
};
var UTF16_LABELS = /* @__PURE__ */ new Map([
  ["utf-16", "utf-16"],
  ["utf16", "utf-16"],
  ["utf_16", "utf-16"],
  ["utf-16le", "utf-16le"],
  ["utf-16be", "utf-16be"]
]);
function resolveLabel(charset) {
  charset = (charset || "utf8").trim().toLowerCase();
  if (ENCODING_LABELS.has(charset)) {
    return charset;
  }
  const utf16 = UTF16_LABELS.get(charset);
  if (utf16) {
    return utf16;
  }
  const normalized = normalizeCharset(charset);
  const codePage = normalized.match(codePagePattern);
  const alias = codePage && codePageAliases.get(codePage[1]) || charsetAliases.get(normalized) || normalized;
  return ENCODING_LABELS.has(alias) ? alias : null;
}
var decoders = /* @__PURE__ */ new Map();
function tryDecoder(label) {
  if (REPLACEMENT_LABELS.has(label)) {
    return replacementDecoder;
  }
  let decoder = decoders.get(label);
  if (decoder === void 0) {
    decoder = null;
    try {
      decoder = new TextDecoder(label);
    } catch {
    }
    decoders.set(label, decoder);
  }
  return decoder;
}
var utf8Decoder = new TextDecoder();
function findDecoder(charset) {
  const label = resolveLabel(charset);
  return label ? tryDecoder(label) : null;
}
function getDecoder(charset) {
  return findDecoder(charset) || tryDecoder("windows-1252") || utf8Decoder;
}
var UTF16_ENCODINGS = /* @__PURE__ */ new Set(["utf-16le", "utf-16be"]);
var UTF16_UNORDERED_LABELS = /* @__PURE__ */ new Set(["utf-16"]);
function bomByteOrder(bytes) {
  if (bytes[0] === 254 && bytes[1] === 255) {
    return "utf-16be";
  }
  if (bytes[0] === 255 && bytes[1] === 254) {
    return "utf-16le";
  }
  return null;
}
function isUtf8(bytes) {
  for (let i = 0; i < bytes.length; ) {
    const lead = bytes[i];
    if (lead < 128) {
      i++;
      continue;
    }
    let count;
    if (lead >= 194 && lead <= 223) {
      count = 1;
    } else if (lead >= 224 && lead <= 239) {
      count = 2;
    } else if (lead >= 240 && lead <= 244) {
      count = 3;
    } else {
      return false;
    }
    if (i + count >= bytes.length) {
      return false;
    }
    const second = bytes[i + 1];
    const min = lead === 224 ? 160 : lead === 240 ? 144 : 128;
    const max = lead === 237 ? 159 : lead === 244 ? 143 : 191;
    if (second < min || second > max) {
      return false;
    }
    for (let k = 2; k <= count; k++) {
      if ((bytes[i + k] & 192) !== 128) {
        return false;
      }
    }
    i += count + 1;
  }
  return true;
}
function decodeUtf8OrWindows1252(bytes, utf8 = utf8Decoder) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return isUtf8(view) ? utf8.decode(view) : getDecoder("windows-1252").decode(view);
}
function decodeCharset(bytes, charset) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const label = resolveLabel(charset);
  let decoder = label ? tryDecoder(label) : null;
  if (label && UTF16_UNORDERED_LABELS.has(label)) {
    const order2 = bomByteOrder(view);
    decoder = order2 && tryDecoder(order2) || decoder;
  }
  return decoder ? decoder.decode(view) : decodeUtf8OrWindows1252(view);
}
var META_PRESCAN_BYTES = 1024;
var CHARSET_ATTRIBUTE = /charset\s*=\s*["']?\s*([^\s"';>]+)/;
function sniffHtmlCharset(bytes) {
  const head = utf8Decoder.decode(bytes.subarray(0, META_PRESCAN_BYTES)).toLowerCase();
  let pos = 0;
  while ((pos = head.indexOf("<meta", pos)) >= 0) {
    let end = head.indexOf(">", pos);
    if (end < 0) {
      end = head.length;
    }
    const match3 = CHARSET_ATTRIBUTE.exec(head.slice(pos, end));
    if (match3) {
      return match3[1];
    }
    pos = end;
  }
  return null;
}
function decodeText(bytes, charset, html) {
  const view = new Uint8Array(bytes);
  if (charset) {
    return decodeCharset(view, charset);
  }
  const sniffed = html ? sniffHtmlCharset(view) : null;
  const decoder = sniffed ? findDecoder(sniffed) : null;
  if (!decoder || UTF16_ENCODINGS.has(decoder.encoding)) {
    return decodeUtf8OrWindows1252(view);
  }
  return (decoder.encoding === "x-user-defined" ? getDecoder("windows-1252") : decoder).decode(view);
}
async function blobToArrayBuffer(blob) {
  if ("arrayBuffer" in blob) {
    return await blob.arrayBuffer();
  }
  const fr = new FileReader();
  return new Promise((resolve, reject) => {
    fr.onload = () => {
      resolve(fr.result);
    };
    fr.onerror = () => {
      reject(fr.error);
    };
    fr.readAsArrayBuffer(blob);
  });
}
function hexNibble(c) {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 97 && c <= 102) {
    return c - 97 + 10;
  }
  if (c >= 65 && c <= 70) {
    return c - 65 + 10;
  }
  return -1;
}
function foldLineBreaks(str) {
  return str.replace(/[\r\n]+/g, " ");
}
function decodeWord(charset, encoding, str) {
  let splitPos = charset.indexOf("*");
  if (splitPos >= 0) {
    charset = charset.slice(0, splitPos);
  }
  encoding = encoding.toUpperCase();
  let byteStr;
  if (encoding === "Q") {
    str = str.replace(/=\s+([0-9a-fA-F])/g, "=$1").replace(/[_\s]/g, " ");
    let buf = textEncoder.encode(str);
    let encodedBytes = [];
    for (let i = 0, len = buf.length; i < len; i++) {
      let c = buf[i];
      if (i <= len - 2 && c === 61) {
        let high = hexNibble(buf[i + 1]);
        let low = hexNibble(buf[i + 2]);
        if (high >= 0 && low >= 0) {
          encodedBytes.push(high << 4 | low);
          i += 2;
          continue;
        }
      }
      encodedBytes.push(c);
    }
    byteStr = new ArrayBuffer(encodedBytes.length);
    let dataView = new DataView(byteStr);
    for (let i = 0, len = encodedBytes.length; i < len; i++) {
      dataView.setUint8(i, encodedBytes[i]);
    }
  } else if (encoding === "B") {
    byteStr = decodeBase64(str.replace(/[^a-zA-Z0-9\+\/=]+/g, ""));
  } else {
    byteStr = textEncoder.encode(str);
  }
  return foldLineBreaks(decodeCharset(byteStr, charset));
}
var ENCODED_WORD_PATTERN = "=\\?([^?\\s]+)\\?([QqBb])\\?([^?]*)\\?=";
var ENCODED_WORD_REGEX = new RegExp(ENCODED_WORD_PATTERN, "g");
var WORD_SEPARATOR_REGEX = /^[ \t\r\n]+$/;
var ENCODED_WORDS_ONLY_REGEX = new RegExp(`^(?:${ENCODED_WORD_PATTERN}\\s*)+$`);
function isEncodedWordsOnly(str) {
  return ENCODED_WORDS_ONLY_REGEX.test(str);
}
function splitEncodedWords(str) {
  const tokens = [];
  ENCODED_WORD_REGEX.lastIndex = 0;
  let pos = 0;
  let match3;
  while (match3 = ENCODED_WORD_REGEX.exec(str)) {
    if (match3.index > pos) {
      tokens.push({ text: str.substring(pos, match3.index) });
    }
    tokens.push({ charset: match3[1], encoding: match3[2], encodedText: match3[3] });
    pos = match3.index + match3[0].length;
  }
  if (pos < str.length) {
    tokens.push({ text: str.substring(pos) });
  }
  return tokens;
}
function canJoinWords(left, right) {
  const encoding = left.encoding.toUpperCase();
  if (left.charset !== right.charset || encoding !== right.encoding.toUpperCase()) {
    return false;
  }
  if (encoding === "B") {
    return left.encodedText.length % 4 === 0 && !left.padded;
  }
  return true;
}
function renderTokens(tokens, joinWords) {
  let result = "";
  let pending = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.text !== void 0) {
      const nextToken = tokens[i + 1];
      if (pending && nextToken && nextToken.text === void 0 && WORD_SEPARATOR_REGEX.test(token.text)) {
        continue;
      }
      if (pending) {
        result += decodeWord(pending.charset, pending.encoding, pending.encodedText);
        pending = null;
      }
      result += token.text;
      continue;
    }
    if (pending && joinWords && canJoinWords(pending, token)) {
      pending.encodedText += token.encodedText;
      pending.padded = token.encodedText.endsWith("=");
      continue;
    }
    if (pending) {
      result += decodeWord(pending.charset, pending.encoding, pending.encodedText);
    }
    pending = {
      charset: token.charset,
      encoding: token.encoding,
      encodedText: token.encodedText,
      padded: token.encodedText.endsWith("=")
    };
  }
  if (pending) {
    result += decodeWord(pending.charset, pending.encoding, pending.encodedText);
  }
  return result;
}
function decodeWords(str) {
  const tokens = splitEncodedWords((str || "").toString());
  const result = renderTokens(tokens, true);
  return result.indexOf("\uFFFD") < 0 ? result : renderTokens(tokens, false);
}
function decodeURIComponentWithCharset(encodedStr, charset) {
  charset = charset || "utf-8";
  let encodedBytes = [];
  for (let i = 0; i < encodedStr.length; i++) {
    let c = encodedStr.charAt(i);
    const high = c === "%" ? hexNibble(encodedStr.charCodeAt(i + 1)) : -1;
    const low = high >= 0 ? hexNibble(encodedStr.charCodeAt(i + 2)) : -1;
    if (low >= 0) {
      encodedBytes.push(high << 4 | low);
      i += 2;
    } else if (c.charCodeAt(0) > 126) {
      const bytes = textEncoder.encode(c);
      for (let j = 0; j < bytes.length; j++) {
        encodedBytes.push(bytes[j]);
      }
    } else {
      encodedBytes.push(c.charCodeAt(0));
    }
  }
  const byteStr = new ArrayBuffer(encodedBytes.length);
  const dataView = new DataView(byteStr);
  for (let i = 0, len = encodedBytes.length; i < len; i++) {
    dataView.setUint8(i, encodedBytes[i]);
  }
  return decodeCharset(byteStr, charset);
}
function decodeParameterValueContinuations(header) {
  let paramKeys = /* @__PURE__ */ new Map();
  Object.keys(header.params).forEach((key) => {
    let match3 = key.match(/\*((\d+)\*?)?$/);
    if (!match3) {
      return;
    }
    let actualKey = key.slice(0, match3.index).toLowerCase();
    let nr = Number(match3[2]) || 0;
    let paramVal = paramKeys.get(actualKey);
    if (!paramVal) {
      paramVal = {
        charset: null,
        values: []
      };
      paramKeys.set(actualKey, paramVal);
    }
    let value = header.params[key];
    let encoded = match3[0].charAt(match3[0].length - 1) === "*";
    if (nr === 0 && encoded && (match3 = value.match(/^([^']*)'[^']*'(.*)$/))) {
      paramVal.charset = match3[1] || "utf-8";
      value = match3[2];
    }
    paramVal.values.push({ nr, value, encoded });
    delete header.params[key];
  });
  paramKeys.forEach((paramVal, key) => {
    if (Object.prototype.hasOwnProperty.call(header.params, key)) {
      return;
    }
    let result = "";
    let pending = "";
    for (let part of paramVal.values.sort((a, b) => a.nr - b.nr)) {
      if (part.encoded) {
        pending += part.value;
        continue;
      }
      if (pending) {
        result += decodeURIComponentWithCharset(pending, paramVal.charset);
        pending = "";
      }
      result += part.value;
    }
    if (pending) {
      result += decodeURIComponentWithCharset(pending, paramVal.charset);
    }
    header.params[key] = result;
  });
}

// node_modules/postal-mime/dist/esm/pass-through-decoder.js
var PassThroughDecoder = class {
  constructor() {
    this.chunks = [];
    this.runBuffer = null;
    this.runStart = 0;
    this.runEnd = 0;
    this.pendingLineBreak = null;
  }
  // Whether the bytes sit in the run's buffer right at the end of the run
  continuesRun(bytes) {
    return bytes.buffer === this.runBuffer && bytes.byteOffset === this.runEnd;
  }
  flushRun() {
    if (this.runBuffer && this.runEnd > this.runStart) {
      this.chunks.push(new Uint8Array(this.runBuffer, this.runStart, this.runEnd - this.runStart));
    }
    this.runBuffer = null;
  }
  update(line, lineBreak) {
    const pending = this.pendingLineBreak;
    if (pending && this.continuesRun(pending) && line.buffer === this.runBuffer && line.byteOffset === this.runEnd + pending.byteLength) {
      this.runEnd = line.byteOffset + line.byteLength;
    } else {
      this.flushRun();
      if (pending) {
        this.chunks.push(pending);
      }
      this.runBuffer = line.buffer;
      this.runStart = line.byteOffset;
      this.runEnd = line.byteOffset + line.byteLength;
    }
    this.pendingLineBreak = lineBreak;
  }
  // A part ended by the end of the message has no boundary to own its final line
  // break, so there it stays content
  finalize(boundaryEnded = false) {
    const pending = this.pendingLineBreak;
    if (!boundaryEnded && pending) {
      if (this.continuesRun(pending)) {
        this.runEnd += pending.byteLength;
      } else {
        this.flushRun();
        this.chunks.push(pending);
      }
    }
    this.flushRun();
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// node_modules/postal-mime/dist/esm/chunk-writer.js
var ChunkWriter = class {
  constructor(maxChunkSize = 100 * 1024) {
    this.maxChunkSize = maxChunkSize;
    this.buffer = null;
    this.bufferPos = 0;
    this.chunks = [];
  }
  writeByte(byte) {
    if (!this.buffer || this.bufferPos >= this.buffer.length) {
      this.flush();
      this.buffer ??= new Uint8Array(this.maxChunkSize);
    }
    this.buffer[this.bufferPos++] = byte;
  }
  // Copied in runs rather than a byte at a time
  writeBytes(bytes, start = 0, end = bytes.length) {
    while (start < end) {
      if (!this.buffer || this.bufferPos >= this.buffer.length) {
        this.flush();
        this.buffer ??= new Uint8Array(this.maxChunkSize);
      }
      const count = Math.min(end - start, this.buffer.length - this.bufferPos);
      this.buffer.set(bytes.subarray(start, start + count), this.bufferPos);
      this.bufferPos += count;
      start += count;
    }
  }
  /**
   * Keeps a buffer the caller hands over and will not touch again. A large one is kept as
   * a chunk of its own instead of being copied, a small one is copied like any other write.
   */
  append(bytes) {
    if (bytes.length >= this.maxChunkSize / 2) {
      this.flush();
      this.chunks.push(bytes);
    } else {
      this.writeBytes(bytes);
    }
  }
  flush() {
    if (this.buffer && this.bufferPos) {
      this.chunks.push(this.buffer.slice(0, this.bufferPos));
      this.bufferPos = 0;
    }
  }
  finalize() {
    this.flush();
    return blobToArrayBuffer(new Blob(this.chunks, { type: "application/octet-stream" }));
  }
};

// node_modules/postal-mime/dist/esm/base64-decoder.js
var Base64Decoder = class {
  constructor(opts) {
    opts = opts || {};
    this.decoder = opts.decoder || new TextDecoder();
    this.maxChunkSize = 100 * 1024;
    this.output = new ChunkWriter();
    this.remainder = "";
  }
  pushChunk(base64Str) {
    if (base64Str.length) {
      this.output.append(new Uint8Array(decodeBase64(base64Str)));
    }
  }
  flushRemainder() {
    this.pushChunk(this.remainder);
    this.remainder = "";
  }
  update(buffer) {
    let str = this.decoder.decode(buffer).replace(/[^a-zA-Z0-9+/=]+/g, "");
    let start = 0;
    let end;
    while ((end = str.indexOf("=", start)) >= 0) {
      this.remainder += str.substring(start, end);
      this.flushRemainder();
      start = end + 1;
    }
    this.remainder += str.substring(start);
    if (this.remainder.length >= this.maxChunkSize) {
      const alignedLength = Math.floor(this.remainder.length / 4) * 4;
      this.pushChunk(this.remainder.substring(0, alignedLength));
      this.remainder = this.remainder.substring(alignedLength);
    }
  }
  finalize() {
    this.flushRemainder();
    return this.output.finalize();
  }
};

// node_modules/postal-mime/dist/esm/qp-decoder.js
var CHR_EQUALS = 61;
var QPDecoder = class {
  constructor() {
    this.output = new ChunkWriter();
    this.pendingLineBreak = null;
  }
  writeLineBreak() {
    if (this.pendingLineBreak) {
      this.output.writeBytes(this.pendingLineBreak);
    }
  }
  // Quoted-printable source is 7 bit by definition, so it is decoded byte by byte and
  // the result is handed on as bytes. Running the body charset over the encoded source
  // instead corrupted every part whose charset was not ASCII compatible: the same
  // content that decoded correctly in base64 came out as mojibake in quoted-printable.
  //
  // As in PassThroughDecoder, a hard line break is only written once the next line
  // arrives, so the CRLF that belongs to a following boundary is not decoded as content,
  // and the break written is the one the line came with.
  update(line, lineBreak) {
    this.writeLineBreak();
    let len = line.length;
    while (len > 0 && isWsp(line[len - 1])) {
      len--;
    }
    const softBreak = len > 0 && line[len - 1] === CHR_EQUALS;
    if (softBreak) {
      len--;
    }
    let literalStart = 0;
    for (let i = 0; i < len; i++) {
      if (line[i] !== CHR_EQUALS || i + 2 >= len) {
        continue;
      }
      const high = hexNibble(line[i + 1]);
      const low = hexNibble(line[i + 2]);
      if (high < 0 || low < 0) {
        continue;
      }
      this.output.writeBytes(line, literalStart, i);
      this.output.writeByte(high << 4 | low);
      i += 2;
      literalStart = i + 1;
    }
    this.output.writeBytes(line, literalStart, len);
    this.pendingLineBreak = softBreak ? null : lineBreak;
  }
  // see PassThroughDecoder.finalize
  finalize(boundaryEnded = false) {
    if (!boundaryEnded) {
      this.writeLineBreak();
    }
    return this.output.finalize();
  }
};

// node_modules/postal-mime/dist/esm/errors.js
var ERROR_TYPES = {
  EINVALIDOPTION: TypeError,
  EINVALIDINPUT: TypeError,
  EPARSERREUSED: Error,
  EMAXNESTINGDEPTH: Error,
  EMAXHEADERSIZE: Error,
  EMAXPARTCOUNT: Error,
  EMAXFORWARDEDADDRESSES: Error
};
function createError(code, message) {
  const error = new ERROR_TYPES[code](message);
  error.code = code;
  return error;
}

// node_modules/postal-mime/dist/esm/mime-node.js
var headerDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
var FLOWED_JOIN_INTERVAL = 4096;
var HEADER_LINE_MIN_COST = 64;
var trimWsp = (str) => {
  let start = 0;
  let end = str.length;
  while (start < end && isWsp(str.charCodeAt(start))) {
    start++;
  }
  while (end > start && isWsp(str.charCodeAt(end - 1))) {
    end--;
  }
  return str.slice(start, end);
};
var FIELD_START = /^(?:From |[!-9;-~]*[ \t]*:)/;
var CONTENT_HEADERS = /* @__PURE__ */ new Set([
  "content-type",
  "content-transfer-encoding",
  "content-disposition",
  "content-id",
  "content-description"
]);
var MimeNode = class {
  constructor(options) {
    this.options = options;
    this.postalMime = options.postalMime;
    const limits = this.postalMime.limits;
    this.postalMime.counters.partCount++;
    if (this.postalMime.counters.partCount > limits.maxPartCount) {
      throw createError("EMAXPARTCOUNT", `Maximum MIME part count of ${limits.maxPartCount} parts exceeded`);
    }
    this.childNodes = [];
    this.finalizedChildCount = 0;
    if (options.parentNode) {
      this.parentNode = options.parentNode;
      this.depth = this.parentNode.depth + 1;
      if (this.depth > limits.maxNestingDepth) {
        throw createError("EMAXNESTINGDEPTH", `Maximum MIME nesting depth of ${limits.maxNestingDepth} levels exceeded`);
      }
      options.parentNode.childNodes.push(this);
    } else {
      this.depth = 0;
    }
    this.state = "header";
    this.headerLines = [];
    const parentMultipartType = options.parentMultipartType || null;
    const defaultContentType = parentMultipartType === "digest" ? "message/rfc822" : "text/plain";
    this.contentType = {
      value: defaultContentType,
      parsed: { value: defaultContentType, params: {} },
      multipart: false
    };
    this.contentTransferEncoding = {
      value: "8bit",
      encoding: ""
    };
    this.contentDisposition = {
      value: "",
      parsed: { value: "", params: {} }
    };
    this.headers = [];
    this.rawHeaderLines = [];
    this.contentDecoder = null;
    this.content = null;
  }
  // `transferEncoding` is the lowercased token of the header, see processHeaders. It is
  // matched whole: `x-base64` or `7bit-base64` is no encoding Python or mailparser
  // decode, and decoding it here rendered as markup a body every other reader keeps as
  // inert base64
  setupContentDecoder(transferEncoding) {
    if (transferEncoding === "base64") {
      this.contentDecoder = new Base64Decoder();
    } else if (transferEncoding === "quoted-printable") {
      this.contentDecoder = new QPDecoder();
    } else {
      this.contentDecoder = new PassThroughDecoder();
    }
  }
  // `boundaryEnded` tells that the part was ended by a multipart boundary, which owns
  // the line break after the last line of the part (RFC 2046 5.1.1)
  async finalize(boundaryEnded = false) {
    if (this.state === "finished") {
      return;
    }
    if (this.state === "header") {
      this.endHeaders();
    }
    this.postalMime.boundaries.remove(this);
    await this.finalizeChildNodes(boundaryEnded);
    this.content = this.contentDecoder ? await this.contentDecoder.finalize(boundaryEnded) : null;
    this.contentDecoder = null;
    this.state = "finished";
  }
  async finalizeChildNodes(boundaryEnded = false) {
    while (this.finalizedChildCount < this.childNodes.length) {
      await this.childNodes[this.finalizedChildCount++].finalize(boundaryEnded);
    }
  }
  // Strip RFC 822 comments (parenthesized text) from structured header values.
  //
  // Inside an unquoted parameter value a parenthesis that continues the current token is
  // content, because `filename=Invoice(1).pdf` is a filename and not a token followed by
  // a comment, and deleting the parens silently renames the attachment.
  stripComments(str) {
    let result = "";
    let depth = 0;
    let escaped = false;
    let inQuote = false;
    let commentStart = -1;
    let inParameterValue = false;
    let runStart = 0;
    const drop = (i) => {
      result += str.slice(runStart, i);
      runStart = i + 1;
    };
    let keptAny = false;
    let endsWithWsp = false;
    const keep = (i) => {
      keptAny = true;
      endsWithWsp = isWsp(str.charCodeAt(i));
    };
    const opensComment = () => !inParameterValue || !keptAny || endsWithWsp;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charAt(i);
      if (escaped) {
        escaped = false;
      } else if (chr === "\\") {
        escaped = true;
      } else if (chr === '"' && depth === 0) {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (chr === "(" && opensComment()) {
          if (depth === 0) {
            commentStart = i;
          }
          depth++;
          drop(i);
          continue;
        }
        if (chr === ")" && depth > 0) {
          depth--;
          drop(i);
          continue;
        }
        if (depth === 0) {
          if (chr === "=") {
            inParameterValue = true;
          } else if (chr === ";") {
            inParameterValue = false;
          }
        }
      }
      if (depth === 0) {
        keep(i);
      } else {
        drop(i);
      }
    }
    if (depth === 0) {
      return result + str.slice(runStart);
    }
    return str.indexOf(";", commentStart) < 0 ? result + str.slice(runStart) : str;
  }
  parseStructuredHeader(str) {
    str = this.stripComments(str);
    let response = {
      value: "",
      params: {}
    };
    let key = false;
    let value = "";
    let stage = "value";
    let pendingSpace = "";
    let quoteClosed = false;
    let quote = false;
    let escaped = false;
    let chr;
    const flushSpace = () => {
      if (value.length) {
        value += pendingSpace;
      }
      pendingSpace = "";
    };
    let runStart = -1;
    const closeRun = (end) => {
      if (runStart >= 0) {
        value += str.slice(runStart, end);
        runStart = -1;
      }
    };
    const addChr = (i) => {
      if (runStart < 0) {
        flushSpace();
        runStart = i;
      }
    };
    const takeValue = () => {
      const result = value;
      value = "";
      pendingSpace = "";
      quoteClosed = false;
      return result;
    };
    const storeParam = (name, result) => {
      if (name && !Object.prototype.hasOwnProperty.call(response.params, name)) {
        response.params[name] = result;
      }
    };
    const storeValue = () => {
      const result = takeValue();
      if (key === false) {
        response.value = result;
      } else {
        storeParam(key, result);
      }
    };
    const storeEmptyKey = () => {
      storeParam(takeValue().trim().toLowerCase(), "");
    };
    for (let i = 0, len = str.length; i < len; i++) {
      chr = str.charAt(i);
      switch (stage) {
        case "key":
          if (chr === "=") {
            closeRun(i);
            key = takeValue().trim().toLowerCase();
            stage = "value";
            break;
          }
          if (chr === ";") {
            closeRun(i);
            storeEmptyKey();
            break;
          }
          if (runStart < 0) {
            runStart = i;
          }
          break;
        case "value":
          if (quoteClosed && chr !== ";") {
            escaped = false;
            break;
          }
          if (escaped) {
            addChr(i);
          } else if (quote && chr === "\\") {
            closeRun(i);
            escaped = true;
            continue;
          } else if (quote && chr === quote) {
            closeRun(i);
            quote = false;
            quoteClosed = true;
          } else if (!quote && chr === '"') {
            closeRun(i);
            quote = chr;
            flushSpace();
          } else if (!quote && chr === ";") {
            closeRun(i);
            storeValue();
            stage = "key";
          } else if (!quote && (chr === " " || chr === "	")) {
            closeRun(i);
            pendingSpace += chr;
          } else {
            addChr(i);
          }
          escaped = false;
          break;
      }
    }
    closeRun(str.length);
    if (stage === "value") {
      storeValue();
    } else {
      storeEmptyKey();
    }
    if (response.value) {
      response.value = response.value.toLowerCase();
    }
    decodeParameterValueContinuations(response);
    return response;
  }
  // Unfolds format=flowed text (RFC 3676 4.1). A line is read as its quote marks, one
  // space of stuffing and its content, in that order, and a line whose content ends in a
  // space is flowed: the next line of the same quote depth continues its paragraph. The
  // paragraph ends at a fixed line, at a change of quote depth and at the signature
  // separator, which is neither flowed nor fixed. Joining a quoted paragraph used to
  // leave the quote marks of the continuation lines inside the text, so a quoted reply
  // read `> one > two` instead of `> one two`.
  //
  // The quote marks and stuffing of the first line of a paragraph are kept as they were
  // written, so a fixed quoted line comes out exactly as it went in. An unquoted stuffed
  // line loses its stuffing, which is all the stuffing is for.
  decodeFlowedText(str, delSp) {
    const chunks = [];
    let parts = [];
    let flowed = false;
    let depth = 0;
    for (let lineStart = 0; lineStart <= str.length; ) {
      let lineEnd = str.indexOf("\n", lineStart);
      if (lineEnd < 0) {
        lineEnd = str.length;
      }
      const line = str.slice(lineStart, lineEnd);
      let quoteDepth = 0;
      while (line.charCodeAt(quoteDepth) === 62) {
        quoteDepth++;
      }
      const contentStart = line.charCodeAt(quoteDepth) === 32 ? quoteDepth + 1 : quoteDepth;
      const content = line.slice(contentStart);
      const isSignature = content === "-- ";
      if (flowed && quoteDepth === depth && !isSignature) {
        if (delSp) {
          const last = parts[parts.length - 1];
          parts[parts.length - 1] = last.slice(0, -1);
        }
        parts.push(content);
      } else {
        if (lineStart) {
          parts.push("\n");
        }
        parts.push(quoteDepth ? line : content);
      }
      flowed = !isSignature && content.endsWith(" ");
      depth = quoteDepth;
      if (parts.length >= FLOWED_JOIN_INTERVAL) {
        const last = parts.pop();
        chunks.push(parts.join(""));
        parts = [last];
      }
      lineStart = lineEnd + 1;
    }
    chunks.push(parts.join(""));
    return chunks.join("");
  }
  getTextContent() {
    if (!this.content) {
      return "";
    }
    let str = decodeText(this.content, this.contentType.parsed.params.charset, this.contentType.parsed.value === "text/html").replace(/\r\n/g, "\n");
    if (this.contentType.parsed.value === "text/plain" && /^flowed$/i.test(this.contentType.parsed.params.format)) {
      str = this.decodeFlowedText(str, /^yes$/i.test(this.contentType.parsed.params.delsp));
    }
    return str;
  }
  processHeaders() {
    let foldedLines = [];
    for (let line of this.headerLines) {
      if (foldedLines.length && /^[ \t]/.test(line)) {
        foldedLines[foldedLines.length - 1].push(line);
      } else {
        foldedLines.push([line]);
      }
    }
    let seenContentHeaders = /* @__PURE__ */ new Set();
    for (let parts of foldedLines) {
      let rawLine = parts.join("\n");
      let sep = rawLine.indexOf(":");
      let rawKey = sep < 0 ? rawLine : rawLine.slice(0, sep);
      this.rawHeaderLines.push({
        key: rawKey.toLowerCase(),
        line: rawLine
      });
      let unfoldedLine = parts.join("");
      sep = unfoldedLine.indexOf(":");
      let key = sep < 0 ? unfoldedLine : unfoldedLine.slice(0, sep);
      let value = sep < 0 ? "" : trimWsp(foldLineBreaks(unfoldedLine.slice(sep + 1)));
      this.headers.push({ key: key.toLowerCase(), originalKey: key, value });
      const lowerKey = key.toLowerCase();
      if (CONTENT_HEADERS.has(lowerKey) && !seenContentHeaders.has(lowerKey)) {
        seenContentHeaders.add(lowerKey);
        switch (lowerKey) {
          case "content-type":
            this.contentType.value = value;
            break;
          case "content-transfer-encoding":
            this.contentTransferEncoding.value = value;
            break;
          case "content-disposition":
            this.contentDisposition.value = value;
            break;
          case "content-id":
            this.contentId = value;
            break;
          case "content-description":
            this.contentDescription = value;
            break;
        }
      }
    }
    this.contentType.parsed = this.parseStructuredHeader(this.contentType.value);
    this.contentType.multipart = /^multipart\//i.test(this.contentType.parsed.value) ? this.contentType.parsed.value.slice(this.contentType.parsed.value.indexOf("/") + 1) : false;
    let boundary = this.contentType.multipart ? (this.contentType.parsed.params.boundary || "").trimEnd() : "";
    if (/[^\x00-\x7f]/.test(boundary)) {
      boundary = "";
    }
    if (this.contentType.multipart && !boundary) {
      this.contentType.parsed.value = "text/plain";
      this.contentType.multipart = false;
    }
    if (this.contentType.multipart) {
      this.postalMime.boundaries.push(boundary, this);
    }
    this.contentDisposition.parsed = this.parseStructuredHeader(this.contentDisposition.value);
    const disposition = this.contentDisposition.parsed.value;
    const dispositionEnd = disposition.search(/[ \t]/);
    if (dispositionEnd >= 0) {
      this.contentDisposition.parsed.value = disposition.slice(0, dispositionEnd);
    }
    this.contentTransferEncoding.encoding = (this.stripComments(this.contentTransferEncoding.value).toLowerCase().match(/^[ \t]*([\w-]+)/) || ["", ""])[1];
    this.setupContentDecoder(this.contentTransferEncoding.encoding);
    this.headerLines = [];
  }
  // Ends the header section and sets up the body
  endHeaders() {
    this.state = "body";
    this.processHeaders();
  }
  // Returns true when the line was not consumed: the headers ended with the line before
  // it, and the parser has to read it again, since the boundary this part declares was
  // not known yet when the line was checked for one
  feed(line, lineBreak) {
    switch (this.state) {
      case "header": {
        if (!line.length) {
          this.endHeaders();
          return false;
        }
        this.postalMime.counters.headerSize += Math.max(line.length, HEADER_LINE_MIN_COST);
        const maxHeadersSize = this.postalMime.limits.maxHeadersSize;
        if (this.postalMime.counters.headerSize > maxHeadersSize) {
          throw createError("EMAXHEADERSIZE", `Maximum header size of ${maxHeadersSize} bytes exceeded`);
        }
        const text = decodeUtf8OrWindows1252(line, headerDecoder);
        if (!isWsp(line[0]) && !FIELD_START.test(text)) {
          this.endHeaders();
          return true;
        }
        this.headerLines.push(text);
        break;
      }
      case "body":
        if (this.contentDecoder) {
          this.contentDecoder.update(line, lineBreak);
        }
        break;
    }
    return false;
  }
};

// node_modules/postal-mime/dist/esm/boundary-stack.js
var keyDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
var BoundaryStack = class {
  constructor() {
    this.byValue = /* @__PURE__ */ new Map();
    this.byNode = /* @__PURE__ */ new Map();
    this.lengths = /* @__PURE__ */ new Map();
    this.nextOrder = 0;
  }
  get size() {
    return this.byNode.size;
  }
  /** Registers the boundary of a multipart node, which must be ASCII and not end in whitespace */
  push(value, node) {
    const boundary = { value, node, order: this.nextOrder++ };
    const list = this.byValue.get(value);
    if (list) {
      list.push(boundary);
    } else {
      this.byValue.set(value, [boundary]);
    }
    this.byNode.set(node, boundary);
    this.lengths.set(value.length, (this.lengths.get(value.length) || 0) + 1);
  }
  /** Removes the boundary of a node, if it registered one */
  remove(node) {
    const boundary = this.byNode.get(node);
    if (!boundary) {
      return;
    }
    this.byNode.delete(node);
    const list = this.byValue.get(boundary.value);
    if (list.length === 1) {
      this.byValue.delete(boundary.value);
    } else {
      list.splice(list.indexOf(boundary), 1);
    }
    const count = this.lengths.get(boundary.value.length) - 1;
    if (count) {
      this.lengths.set(boundary.value.length, count);
    } else {
      this.lengths.delete(boundary.value.length);
    }
  }
  /**
   * Finds the boundary a line delimits or terminates: `--` and the boundary, optionally
   * `--`, then optional whitespace (RFC 2046 5.1.1). When the line matches more than one
   * open boundary, the outermost wins: a boundary may not appear inside the parts it
   * delimits, and when a nested multipart declares the boundary of an ancestor anyway, or
   * one that the ancestor's terminator matches, the ancestor's delimiter is the one every
   * other parser reads the line as. Reading it as the nested one instead gave the nested
   * multipart parts, and an attachment after the ancestor's terminator, that Python and
   * Go leave in the epilogue.
   */
  match(line) {
    if (!this.byNode.size || line.length <= 2 || line[0] !== 45 || line[1] !== 45) {
      return null;
    }
    let end = line.length;
    while (end > 2 && isWsp(line[end - 1])) {
      end--;
    }
    const delimiter = this.find(line, end);
    const terminator = end - 2 >= 2 && line[end - 1] === 45 && line[end - 2] === 45 ? this.find(line, end - 2) : null;
    if (terminator && (!delimiter || terminator.order < delimiter.order)) {
      return { node: terminator.node, isTerminator: true };
    }
    return delimiter ? { node: delimiter.node, isTerminator: false } : null;
  }
  // the outermost open boundary equal to line[2..end]
  find(line, end) {
    if (!this.lengths.has(end - 2)) {
      return null;
    }
    const list = this.byValue.get(keyDecoder.decode(line.subarray(2, end)));
    return list ? list[0] : null;
  }
};

// node_modules/postal-mime/dist/esm/html-entities.js
var htmlEntities = {
  "&AElig": "\xC6",
  "&AElig;": "\xC6",
  "&AMP": "&",
  "&AMP;": "&",
  "&Aacute": "\xC1",
  "&Aacute;": "\xC1",
  "&Abreve;": "\u0102",
  "&Acirc": "\xC2",
  "&Acirc;": "\xC2",
  "&Acy;": "\u0410",
  "&Afr;": "\u{1D504}",
  "&Agrave": "\xC0",
  "&Agrave;": "\xC0",
  "&Alpha;": "\u0391",
  "&Amacr;": "\u0100",
  "&And;": "\u2A53",
  "&Aogon;": "\u0104",
  "&Aopf;": "\u{1D538}",
  "&ApplyFunction;": "\u2061",
  "&Aring": "\xC5",
  "&Aring;": "\xC5",
  "&Ascr;": "\u{1D49C}",
  "&Assign;": "\u2254",
  "&Atilde": "\xC3",
  "&Atilde;": "\xC3",
  "&Auml": "\xC4",
  "&Auml;": "\xC4",
  "&Backslash;": "\u2216",
  "&Barv;": "\u2AE7",
  "&Barwed;": "\u2306",
  "&Bcy;": "\u0411",
  "&Because;": "\u2235",
  "&Bernoullis;": "\u212C",
  "&Beta;": "\u0392",
  "&Bfr;": "\u{1D505}",
  "&Bopf;": "\u{1D539}",
  "&Breve;": "\u02D8",
  "&Bscr;": "\u212C",
  "&Bumpeq;": "\u224E",
  "&CHcy;": "\u0427",
  "&COPY": "\xA9",
  "&COPY;": "\xA9",
  "&Cacute;": "\u0106",
  "&Cap;": "\u22D2",
  "&CapitalDifferentialD;": "\u2145",
  "&Cayleys;": "\u212D",
  "&Ccaron;": "\u010C",
  "&Ccedil": "\xC7",
  "&Ccedil;": "\xC7",
  "&Ccirc;": "\u0108",
  "&Cconint;": "\u2230",
  "&Cdot;": "\u010A",
  "&Cedilla;": "\xB8",
  "&CenterDot;": "\xB7",
  "&Cfr;": "\u212D",
  "&Chi;": "\u03A7",
  "&CircleDot;": "\u2299",
  "&CircleMinus;": "\u2296",
  "&CirclePlus;": "\u2295",
  "&CircleTimes;": "\u2297",
  "&ClockwiseContourIntegral;": "\u2232",
  "&CloseCurlyDoubleQuote;": "\u201D",
  "&CloseCurlyQuote;": "\u2019",
  "&Colon;": "\u2237",
  "&Colone;": "\u2A74",
  "&Congruent;": "\u2261",
  "&Conint;": "\u222F",
  "&ContourIntegral;": "\u222E",
  "&Copf;": "\u2102",
  "&Coproduct;": "\u2210",
  "&CounterClockwiseContourIntegral;": "\u2233",
  "&Cross;": "\u2A2F",
  "&Cscr;": "\u{1D49E}",
  "&Cup;": "\u22D3",
  "&CupCap;": "\u224D",
  "&DD;": "\u2145",
  "&DDotrahd;": "\u2911",
  "&DJcy;": "\u0402",
  "&DScy;": "\u0405",
  "&DZcy;": "\u040F",
  "&Dagger;": "\u2021",
  "&Darr;": "\u21A1",
  "&Dashv;": "\u2AE4",
  "&Dcaron;": "\u010E",
  "&Dcy;": "\u0414",
  "&Del;": "\u2207",
  "&Delta;": "\u0394",
  "&Dfr;": "\u{1D507}",
  "&DiacriticalAcute;": "\xB4",
  "&DiacriticalDot;": "\u02D9",
  "&DiacriticalDoubleAcute;": "\u02DD",
  "&DiacriticalGrave;": "`",
  "&DiacriticalTilde;": "\u02DC",
  "&Diamond;": "\u22C4",
  "&DifferentialD;": "\u2146",
  "&Dopf;": "\u{1D53B}",
  "&Dot;": "\xA8",
  "&DotDot;": "\u20DC",
  "&DotEqual;": "\u2250",
  "&DoubleContourIntegral;": "\u222F",
  "&DoubleDot;": "\xA8",
  "&DoubleDownArrow;": "\u21D3",
  "&DoubleLeftArrow;": "\u21D0",
  "&DoubleLeftRightArrow;": "\u21D4",
  "&DoubleLeftTee;": "\u2AE4",
  "&DoubleLongLeftArrow;": "\u27F8",
  "&DoubleLongLeftRightArrow;": "\u27FA",
  "&DoubleLongRightArrow;": "\u27F9",
  "&DoubleRightArrow;": "\u21D2",
  "&DoubleRightTee;": "\u22A8",
  "&DoubleUpArrow;": "\u21D1",
  "&DoubleUpDownArrow;": "\u21D5",
  "&DoubleVerticalBar;": "\u2225",
  "&DownArrow;": "\u2193",
  "&DownArrowBar;": "\u2913",
  "&DownArrowUpArrow;": "\u21F5",
  "&DownBreve;": "\u0311",
  "&DownLeftRightVector;": "\u2950",
  "&DownLeftTeeVector;": "\u295E",
  "&DownLeftVector;": "\u21BD",
  "&DownLeftVectorBar;": "\u2956",
  "&DownRightTeeVector;": "\u295F",
  "&DownRightVector;": "\u21C1",
  "&DownRightVectorBar;": "\u2957",
  "&DownTee;": "\u22A4",
  "&DownTeeArrow;": "\u21A7",
  "&Downarrow;": "\u21D3",
  "&Dscr;": "\u{1D49F}",
  "&Dstrok;": "\u0110",
  "&ENG;": "\u014A",
  "&ETH": "\xD0",
  "&ETH;": "\xD0",
  "&Eacute": "\xC9",
  "&Eacute;": "\xC9",
  "&Ecaron;": "\u011A",
  "&Ecirc": "\xCA",
  "&Ecirc;": "\xCA",
  "&Ecy;": "\u042D",
  "&Edot;": "\u0116",
  "&Efr;": "\u{1D508}",
  "&Egrave": "\xC8",
  "&Egrave;": "\xC8",
  "&Element;": "\u2208",
  "&Emacr;": "\u0112",
  "&EmptySmallSquare;": "\u25FB",
  "&EmptyVerySmallSquare;": "\u25AB",
  "&Eogon;": "\u0118",
  "&Eopf;": "\u{1D53C}",
  "&Epsilon;": "\u0395",
  "&Equal;": "\u2A75",
  "&EqualTilde;": "\u2242",
  "&Equilibrium;": "\u21CC",
  "&Escr;": "\u2130",
  "&Esim;": "\u2A73",
  "&Eta;": "\u0397",
  "&Euml": "\xCB",
  "&Euml;": "\xCB",
  "&Exists;": "\u2203",
  "&ExponentialE;": "\u2147",
  "&Fcy;": "\u0424",
  "&Ffr;": "\u{1D509}",
  "&FilledSmallSquare;": "\u25FC",
  "&FilledVerySmallSquare;": "\u25AA",
  "&Fopf;": "\u{1D53D}",
  "&ForAll;": "\u2200",
  "&Fouriertrf;": "\u2131",
  "&Fscr;": "\u2131",
  "&GJcy;": "\u0403",
  "&GT": ">",
  "&GT;": ">",
  "&Gamma;": "\u0393",
  "&Gammad;": "\u03DC",
  "&Gbreve;": "\u011E",
  "&Gcedil;": "\u0122",
  "&Gcirc;": "\u011C",
  "&Gcy;": "\u0413",
  "&Gdot;": "\u0120",
  "&Gfr;": "\u{1D50A}",
  "&Gg;": "\u22D9",
  "&Gopf;": "\u{1D53E}",
  "&GreaterEqual;": "\u2265",
  "&GreaterEqualLess;": "\u22DB",
  "&GreaterFullEqual;": "\u2267",
  "&GreaterGreater;": "\u2AA2",
  "&GreaterLess;": "\u2277",
  "&GreaterSlantEqual;": "\u2A7E",
  "&GreaterTilde;": "\u2273",
  "&Gscr;": "\u{1D4A2}",
  "&Gt;": "\u226B",
  "&HARDcy;": "\u042A",
  "&Hacek;": "\u02C7",
  "&Hat;": "^",
  "&Hcirc;": "\u0124",
  "&Hfr;": "\u210C",
  "&HilbertSpace;": "\u210B",
  "&Hopf;": "\u210D",
  "&HorizontalLine;": "\u2500",
  "&Hscr;": "\u210B",
  "&Hstrok;": "\u0126",
  "&HumpDownHump;": "\u224E",
  "&HumpEqual;": "\u224F",
  "&IEcy;": "\u0415",
  "&IJlig;": "\u0132",
  "&IOcy;": "\u0401",
  "&Iacute": "\xCD",
  "&Iacute;": "\xCD",
  "&Icirc": "\xCE",
  "&Icirc;": "\xCE",
  "&Icy;": "\u0418",
  "&Idot;": "\u0130",
  "&Ifr;": "\u2111",
  "&Igrave": "\xCC",
  "&Igrave;": "\xCC",
  "&Im;": "\u2111",
  "&Imacr;": "\u012A",
  "&ImaginaryI;": "\u2148",
  "&Implies;": "\u21D2",
  "&Int;": "\u222C",
  "&Integral;": "\u222B",
  "&Intersection;": "\u22C2",
  "&InvisibleComma;": "\u2063",
  "&InvisibleTimes;": "\u2062",
  "&Iogon;": "\u012E",
  "&Iopf;": "\u{1D540}",
  "&Iota;": "\u0399",
  "&Iscr;": "\u2110",
  "&Itilde;": "\u0128",
  "&Iukcy;": "\u0406",
  "&Iuml": "\xCF",
  "&Iuml;": "\xCF",
  "&Jcirc;": "\u0134",
  "&Jcy;": "\u0419",
  "&Jfr;": "\u{1D50D}",
  "&Jopf;": "\u{1D541}",
  "&Jscr;": "\u{1D4A5}",
  "&Jsercy;": "\u0408",
  "&Jukcy;": "\u0404",
  "&KHcy;": "\u0425",
  "&KJcy;": "\u040C",
  "&Kappa;": "\u039A",
  "&Kcedil;": "\u0136",
  "&Kcy;": "\u041A",
  "&Kfr;": "\u{1D50E}",
  "&Kopf;": "\u{1D542}",
  "&Kscr;": "\u{1D4A6}",
  "&LJcy;": "\u0409",
  "&LT": "<",
  "&LT;": "<",
  "&Lacute;": "\u0139",
  "&Lambda;": "\u039B",
  "&Lang;": "\u27EA",
  "&Laplacetrf;": "\u2112",
  "&Larr;": "\u219E",
  "&Lcaron;": "\u013D",
  "&Lcedil;": "\u013B",
  "&Lcy;": "\u041B",
  "&LeftAngleBracket;": "\u27E8",
  "&LeftArrow;": "\u2190",
  "&LeftArrowBar;": "\u21E4",
  "&LeftArrowRightArrow;": "\u21C6",
  "&LeftCeiling;": "\u2308",
  "&LeftDoubleBracket;": "\u27E6",
  "&LeftDownTeeVector;": "\u2961",
  "&LeftDownVector;": "\u21C3",
  "&LeftDownVectorBar;": "\u2959",
  "&LeftFloor;": "\u230A",
  "&LeftRightArrow;": "\u2194",
  "&LeftRightVector;": "\u294E",
  "&LeftTee;": "\u22A3",
  "&LeftTeeArrow;": "\u21A4",
  "&LeftTeeVector;": "\u295A",
  "&LeftTriangle;": "\u22B2",
  "&LeftTriangleBar;": "\u29CF",
  "&LeftTriangleEqual;": "\u22B4",
  "&LeftUpDownVector;": "\u2951",
  "&LeftUpTeeVector;": "\u2960",
  "&LeftUpVector;": "\u21BF",
  "&LeftUpVectorBar;": "\u2958",
  "&LeftVector;": "\u21BC",
  "&LeftVectorBar;": "\u2952",
  "&Leftarrow;": "\u21D0",
  "&Leftrightarrow;": "\u21D4",
  "&LessEqualGreater;": "\u22DA",
  "&LessFullEqual;": "\u2266",
  "&LessGreater;": "\u2276",
  "&LessLess;": "\u2AA1",
  "&LessSlantEqual;": "\u2A7D",
  "&LessTilde;": "\u2272",
  "&Lfr;": "\u{1D50F}",
  "&Ll;": "\u22D8",
  "&Lleftarrow;": "\u21DA",
  "&Lmidot;": "\u013F",
  "&LongLeftArrow;": "\u27F5",
  "&LongLeftRightArrow;": "\u27F7",
  "&LongRightArrow;": "\u27F6",
  "&Longleftarrow;": "\u27F8",
  "&Longleftrightarrow;": "\u27FA",
  "&Longrightarrow;": "\u27F9",
  "&Lopf;": "\u{1D543}",
  "&LowerLeftArrow;": "\u2199",
  "&LowerRightArrow;": "\u2198",
  "&Lscr;": "\u2112",
  "&Lsh;": "\u21B0",
  "&Lstrok;": "\u0141",
  "&Lt;": "\u226A",
  "&Map;": "\u2905",
  "&Mcy;": "\u041C",
  "&MediumSpace;": "\u205F",
  "&Mellintrf;": "\u2133",
  "&Mfr;": "\u{1D510}",
  "&MinusPlus;": "\u2213",
  "&Mopf;": "\u{1D544}",
  "&Mscr;": "\u2133",
  "&Mu;": "\u039C",
  "&NJcy;": "\u040A",
  "&Nacute;": "\u0143",
  "&Ncaron;": "\u0147",
  "&Ncedil;": "\u0145",
  "&Ncy;": "\u041D",
  "&NegativeMediumSpace;": "\u200B",
  "&NegativeThickSpace;": "\u200B",
  "&NegativeThinSpace;": "\u200B",
  "&NegativeVeryThinSpace;": "\u200B",
  "&NestedGreaterGreater;": "\u226B",
  "&NestedLessLess;": "\u226A",
  "&NewLine;": "\n",
  "&Nfr;": "\u{1D511}",
  "&NoBreak;": "\u2060",
  "&NonBreakingSpace;": "\xA0",
  "&Nopf;": "\u2115",
  "&Not;": "\u2AEC",
  "&NotCongruent;": "\u2262",
  "&NotCupCap;": "\u226D",
  "&NotDoubleVerticalBar;": "\u2226",
  "&NotElement;": "\u2209",
  "&NotEqual;": "\u2260",
  "&NotEqualTilde;": "\u2242\u0338",
  "&NotExists;": "\u2204",
  "&NotGreater;": "\u226F",
  "&NotGreaterEqual;": "\u2271",
  "&NotGreaterFullEqual;": "\u2267\u0338",
  "&NotGreaterGreater;": "\u226B\u0338",
  "&NotGreaterLess;": "\u2279",
  "&NotGreaterSlantEqual;": "\u2A7E\u0338",
  "&NotGreaterTilde;": "\u2275",
  "&NotHumpDownHump;": "\u224E\u0338",
  "&NotHumpEqual;": "\u224F\u0338",
  "&NotLeftTriangle;": "\u22EA",
  "&NotLeftTriangleBar;": "\u29CF\u0338",
  "&NotLeftTriangleEqual;": "\u22EC",
  "&NotLess;": "\u226E",
  "&NotLessEqual;": "\u2270",
  "&NotLessGreater;": "\u2278",
  "&NotLessLess;": "\u226A\u0338",
  "&NotLessSlantEqual;": "\u2A7D\u0338",
  "&NotLessTilde;": "\u2274",
  "&NotNestedGreaterGreater;": "\u2AA2\u0338",
  "&NotNestedLessLess;": "\u2AA1\u0338",
  "&NotPrecedes;": "\u2280",
  "&NotPrecedesEqual;": "\u2AAF\u0338",
  "&NotPrecedesSlantEqual;": "\u22E0",
  "&NotReverseElement;": "\u220C",
  "&NotRightTriangle;": "\u22EB",
  "&NotRightTriangleBar;": "\u29D0\u0338",
  "&NotRightTriangleEqual;": "\u22ED",
  "&NotSquareSubset;": "\u228F\u0338",
  "&NotSquareSubsetEqual;": "\u22E2",
  "&NotSquareSuperset;": "\u2290\u0338",
  "&NotSquareSupersetEqual;": "\u22E3",
  "&NotSubset;": "\u2282\u20D2",
  "&NotSubsetEqual;": "\u2288",
  "&NotSucceeds;": "\u2281",
  "&NotSucceedsEqual;": "\u2AB0\u0338",
  "&NotSucceedsSlantEqual;": "\u22E1",
  "&NotSucceedsTilde;": "\u227F\u0338",
  "&NotSuperset;": "\u2283\u20D2",
  "&NotSupersetEqual;": "\u2289",
  "&NotTilde;": "\u2241",
  "&NotTildeEqual;": "\u2244",
  "&NotTildeFullEqual;": "\u2247",
  "&NotTildeTilde;": "\u2249",
  "&NotVerticalBar;": "\u2224",
  "&Nscr;": "\u{1D4A9}",
  "&Ntilde": "\xD1",
  "&Ntilde;": "\xD1",
  "&Nu;": "\u039D",
  "&OElig;": "\u0152",
  "&Oacute": "\xD3",
  "&Oacute;": "\xD3",
  "&Ocirc": "\xD4",
  "&Ocirc;": "\xD4",
  "&Ocy;": "\u041E",
  "&Odblac;": "\u0150",
  "&Ofr;": "\u{1D512}",
  "&Ograve": "\xD2",
  "&Ograve;": "\xD2",
  "&Omacr;": "\u014C",
  "&Omega;": "\u03A9",
  "&Omicron;": "\u039F",
  "&Oopf;": "\u{1D546}",
  "&OpenCurlyDoubleQuote;": "\u201C",
  "&OpenCurlyQuote;": "\u2018",
  "&Or;": "\u2A54",
  "&Oscr;": "\u{1D4AA}",
  "&Oslash": "\xD8",
  "&Oslash;": "\xD8",
  "&Otilde": "\xD5",
  "&Otilde;": "\xD5",
  "&Otimes;": "\u2A37",
  "&Ouml": "\xD6",
  "&Ouml;": "\xD6",
  "&OverBar;": "\u203E",
  "&OverBrace;": "\u23DE",
  "&OverBracket;": "\u23B4",
  "&OverParenthesis;": "\u23DC",
  "&PartialD;": "\u2202",
  "&Pcy;": "\u041F",
  "&Pfr;": "\u{1D513}",
  "&Phi;": "\u03A6",
  "&Pi;": "\u03A0",
  "&PlusMinus;": "\xB1",
  "&Poincareplane;": "\u210C",
  "&Popf;": "\u2119",
  "&Pr;": "\u2ABB",
  "&Precedes;": "\u227A",
  "&PrecedesEqual;": "\u2AAF",
  "&PrecedesSlantEqual;": "\u227C",
  "&PrecedesTilde;": "\u227E",
  "&Prime;": "\u2033",
  "&Product;": "\u220F",
  "&Proportion;": "\u2237",
  "&Proportional;": "\u221D",
  "&Pscr;": "\u{1D4AB}",
  "&Psi;": "\u03A8",
  "&QUOT": '"',
  "&QUOT;": '"',
  "&Qfr;": "\u{1D514}",
  "&Qopf;": "\u211A",
  "&Qscr;": "\u{1D4AC}",
  "&RBarr;": "\u2910",
  "&REG": "\xAE",
  "&REG;": "\xAE",
  "&Racute;": "\u0154",
  "&Rang;": "\u27EB",
  "&Rarr;": "\u21A0",
  "&Rarrtl;": "\u2916",
  "&Rcaron;": "\u0158",
  "&Rcedil;": "\u0156",
  "&Rcy;": "\u0420",
  "&Re;": "\u211C",
  "&ReverseElement;": "\u220B",
  "&ReverseEquilibrium;": "\u21CB",
  "&ReverseUpEquilibrium;": "\u296F",
  "&Rfr;": "\u211C",
  "&Rho;": "\u03A1",
  "&RightAngleBracket;": "\u27E9",
  "&RightArrow;": "\u2192",
  "&RightArrowBar;": "\u21E5",
  "&RightArrowLeftArrow;": "\u21C4",
  "&RightCeiling;": "\u2309",
  "&RightDoubleBracket;": "\u27E7",
  "&RightDownTeeVector;": "\u295D",
  "&RightDownVector;": "\u21C2",
  "&RightDownVectorBar;": "\u2955",
  "&RightFloor;": "\u230B",
  "&RightTee;": "\u22A2",
  "&RightTeeArrow;": "\u21A6",
  "&RightTeeVector;": "\u295B",
  "&RightTriangle;": "\u22B3",
  "&RightTriangleBar;": "\u29D0",
  "&RightTriangleEqual;": "\u22B5",
  "&RightUpDownVector;": "\u294F",
  "&RightUpTeeVector;": "\u295C",
  "&RightUpVector;": "\u21BE",
  "&RightUpVectorBar;": "\u2954",
  "&RightVector;": "\u21C0",
  "&RightVectorBar;": "\u2953",
  "&Rightarrow;": "\u21D2",
  "&Ropf;": "\u211D",
  "&RoundImplies;": "\u2970",
  "&Rrightarrow;": "\u21DB",
  "&Rscr;": "\u211B",
  "&Rsh;": "\u21B1",
  "&RuleDelayed;": "\u29F4",
  "&SHCHcy;": "\u0429",
  "&SHcy;": "\u0428",
  "&SOFTcy;": "\u042C",
  "&Sacute;": "\u015A",
  "&Sc;": "\u2ABC",
  "&Scaron;": "\u0160",
  "&Scedil;": "\u015E",
  "&Scirc;": "\u015C",
  "&Scy;": "\u0421",
  "&Sfr;": "\u{1D516}",
  "&ShortDownArrow;": "\u2193",
  "&ShortLeftArrow;": "\u2190",
  "&ShortRightArrow;": "\u2192",
  "&ShortUpArrow;": "\u2191",
  "&Sigma;": "\u03A3",
  "&SmallCircle;": "\u2218",
  "&Sopf;": "\u{1D54A}",
  "&Sqrt;": "\u221A",
  "&Square;": "\u25A1",
  "&SquareIntersection;": "\u2293",
  "&SquareSubset;": "\u228F",
  "&SquareSubsetEqual;": "\u2291",
  "&SquareSuperset;": "\u2290",
  "&SquareSupersetEqual;": "\u2292",
  "&SquareUnion;": "\u2294",
  "&Sscr;": "\u{1D4AE}",
  "&Star;": "\u22C6",
  "&Sub;": "\u22D0",
  "&Subset;": "\u22D0",
  "&SubsetEqual;": "\u2286",
  "&Succeeds;": "\u227B",
  "&SucceedsEqual;": "\u2AB0",
  "&SucceedsSlantEqual;": "\u227D",
  "&SucceedsTilde;": "\u227F",
  "&SuchThat;": "\u220B",
  "&Sum;": "\u2211",
  "&Sup;": "\u22D1",
  "&Superset;": "\u2283",
  "&SupersetEqual;": "\u2287",
  "&Supset;": "\u22D1",
  "&THORN": "\xDE",
  "&THORN;": "\xDE",
  "&TRADE;": "\u2122",
  "&TSHcy;": "\u040B",
  "&TScy;": "\u0426",
  "&Tab;": "	",
  "&Tau;": "\u03A4",
  "&Tcaron;": "\u0164",
  "&Tcedil;": "\u0162",
  "&Tcy;": "\u0422",
  "&Tfr;": "\u{1D517}",
  "&Therefore;": "\u2234",
  "&Theta;": "\u0398",
  "&ThickSpace;": "\u205F\u200A",
  "&ThinSpace;": "\u2009",
  "&Tilde;": "\u223C",
  "&TildeEqual;": "\u2243",
  "&TildeFullEqual;": "\u2245",
  "&TildeTilde;": "\u2248",
  "&Topf;": "\u{1D54B}",
  "&TripleDot;": "\u20DB",
  "&Tscr;": "\u{1D4AF}",
  "&Tstrok;": "\u0166",
  "&Uacute": "\xDA",
  "&Uacute;": "\xDA",
  "&Uarr;": "\u219F",
  "&Uarrocir;": "\u2949",
  "&Ubrcy;": "\u040E",
  "&Ubreve;": "\u016C",
  "&Ucirc": "\xDB",
  "&Ucirc;": "\xDB",
  "&Ucy;": "\u0423",
  "&Udblac;": "\u0170",
  "&Ufr;": "\u{1D518}",
  "&Ugrave": "\xD9",
  "&Ugrave;": "\xD9",
  "&Umacr;": "\u016A",
  "&UnderBar;": "_",
  "&UnderBrace;": "\u23DF",
  "&UnderBracket;": "\u23B5",
  "&UnderParenthesis;": "\u23DD",
  "&Union;": "\u22C3",
  "&UnionPlus;": "\u228E",
  "&Uogon;": "\u0172",
  "&Uopf;": "\u{1D54C}",
  "&UpArrow;": "\u2191",
  "&UpArrowBar;": "\u2912",
  "&UpArrowDownArrow;": "\u21C5",
  "&UpDownArrow;": "\u2195",
  "&UpEquilibrium;": "\u296E",
  "&UpTee;": "\u22A5",
  "&UpTeeArrow;": "\u21A5",
  "&Uparrow;": "\u21D1",
  "&Updownarrow;": "\u21D5",
  "&UpperLeftArrow;": "\u2196",
  "&UpperRightArrow;": "\u2197",
  "&Upsi;": "\u03D2",
  "&Upsilon;": "\u03A5",
  "&Uring;": "\u016E",
  "&Uscr;": "\u{1D4B0}",
  "&Utilde;": "\u0168",
  "&Uuml": "\xDC",
  "&Uuml;": "\xDC",
  "&VDash;": "\u22AB",
  "&Vbar;": "\u2AEB",
  "&Vcy;": "\u0412",
  "&Vdash;": "\u22A9",
  "&Vdashl;": "\u2AE6",
  "&Vee;": "\u22C1",
  "&Verbar;": "\u2016",
  "&Vert;": "\u2016",
  "&VerticalBar;": "\u2223",
  "&VerticalLine;": "|",
  "&VerticalSeparator;": "\u2758",
  "&VerticalTilde;": "\u2240",
  "&VeryThinSpace;": "\u200A",
  "&Vfr;": "\u{1D519}",
  "&Vopf;": "\u{1D54D}",
  "&Vscr;": "\u{1D4B1}",
  "&Vvdash;": "\u22AA",
  "&Wcirc;": "\u0174",
  "&Wedge;": "\u22C0",
  "&Wfr;": "\u{1D51A}",
  "&Wopf;": "\u{1D54E}",
  "&Wscr;": "\u{1D4B2}",
  "&Xfr;": "\u{1D51B}",
  "&Xi;": "\u039E",
  "&Xopf;": "\u{1D54F}",
  "&Xscr;": "\u{1D4B3}",
  "&YAcy;": "\u042F",
  "&YIcy;": "\u0407",
  "&YUcy;": "\u042E",
  "&Yacute": "\xDD",
  "&Yacute;": "\xDD",
  "&Ycirc;": "\u0176",
  "&Ycy;": "\u042B",
  "&Yfr;": "\u{1D51C}",
  "&Yopf;": "\u{1D550}",
  "&Yscr;": "\u{1D4B4}",
  "&Yuml;": "\u0178",
  "&ZHcy;": "\u0416",
  "&Zacute;": "\u0179",
  "&Zcaron;": "\u017D",
  "&Zcy;": "\u0417",
  "&Zdot;": "\u017B",
  "&ZeroWidthSpace;": "\u200B",
  "&Zeta;": "\u0396",
  "&Zfr;": "\u2128",
  "&Zopf;": "\u2124",
  "&Zscr;": "\u{1D4B5}",
  "&aacute": "\xE1",
  "&aacute;": "\xE1",
  "&abreve;": "\u0103",
  "&ac;": "\u223E",
  "&acE;": "\u223E\u0333",
  "&acd;": "\u223F",
  "&acirc": "\xE2",
  "&acirc;": "\xE2",
  "&acute": "\xB4",
  "&acute;": "\xB4",
  "&acy;": "\u0430",
  "&aelig": "\xE6",
  "&aelig;": "\xE6",
  "&af;": "\u2061",
  "&afr;": "\u{1D51E}",
  "&agrave": "\xE0",
  "&agrave;": "\xE0",
  "&alefsym;": "\u2135",
  "&aleph;": "\u2135",
  "&alpha;": "\u03B1",
  "&amacr;": "\u0101",
  "&amalg;": "\u2A3F",
  "&amp": "&",
  "&amp;": "&",
  "&and;": "\u2227",
  "&andand;": "\u2A55",
  "&andd;": "\u2A5C",
  "&andslope;": "\u2A58",
  "&andv;": "\u2A5A",
  "&ang;": "\u2220",
  "&ange;": "\u29A4",
  "&angle;": "\u2220",
  "&angmsd;": "\u2221",
  "&angmsdaa;": "\u29A8",
  "&angmsdab;": "\u29A9",
  "&angmsdac;": "\u29AA",
  "&angmsdad;": "\u29AB",
  "&angmsdae;": "\u29AC",
  "&angmsdaf;": "\u29AD",
  "&angmsdag;": "\u29AE",
  "&angmsdah;": "\u29AF",
  "&angrt;": "\u221F",
  "&angrtvb;": "\u22BE",
  "&angrtvbd;": "\u299D",
  "&angsph;": "\u2222",
  "&angst;": "\xC5",
  "&angzarr;": "\u237C",
  "&aogon;": "\u0105",
  "&aopf;": "\u{1D552}",
  "&ap;": "\u2248",
  "&apE;": "\u2A70",
  "&apacir;": "\u2A6F",
  "&ape;": "\u224A",
  "&apid;": "\u224B",
  "&apos;": "'",
  "&approx;": "\u2248",
  "&approxeq;": "\u224A",
  "&aring": "\xE5",
  "&aring;": "\xE5",
  "&ascr;": "\u{1D4B6}",
  "&ast;": "*",
  "&asymp;": "\u2248",
  "&asympeq;": "\u224D",
  "&atilde": "\xE3",
  "&atilde;": "\xE3",
  "&auml": "\xE4",
  "&auml;": "\xE4",
  "&awconint;": "\u2233",
  "&awint;": "\u2A11",
  "&bNot;": "\u2AED",
  "&backcong;": "\u224C",
  "&backepsilon;": "\u03F6",
  "&backprime;": "\u2035",
  "&backsim;": "\u223D",
  "&backsimeq;": "\u22CD",
  "&barvee;": "\u22BD",
  "&barwed;": "\u2305",
  "&barwedge;": "\u2305",
  "&bbrk;": "\u23B5",
  "&bbrktbrk;": "\u23B6",
  "&bcong;": "\u224C",
  "&bcy;": "\u0431",
  "&bdquo;": "\u201E",
  "&becaus;": "\u2235",
  "&because;": "\u2235",
  "&bemptyv;": "\u29B0",
  "&bepsi;": "\u03F6",
  "&bernou;": "\u212C",
  "&beta;": "\u03B2",
  "&beth;": "\u2136",
  "&between;": "\u226C",
  "&bfr;": "\u{1D51F}",
  "&bigcap;": "\u22C2",
  "&bigcirc;": "\u25EF",
  "&bigcup;": "\u22C3",
  "&bigodot;": "\u2A00",
  "&bigoplus;": "\u2A01",
  "&bigotimes;": "\u2A02",
  "&bigsqcup;": "\u2A06",
  "&bigstar;": "\u2605",
  "&bigtriangledown;": "\u25BD",
  "&bigtriangleup;": "\u25B3",
  "&biguplus;": "\u2A04",
  "&bigvee;": "\u22C1",
  "&bigwedge;": "\u22C0",
  "&bkarow;": "\u290D",
  "&blacklozenge;": "\u29EB",
  "&blacksquare;": "\u25AA",
  "&blacktriangle;": "\u25B4",
  "&blacktriangledown;": "\u25BE",
  "&blacktriangleleft;": "\u25C2",
  "&blacktriangleright;": "\u25B8",
  "&blank;": "\u2423",
  "&blk12;": "\u2592",
  "&blk14;": "\u2591",
  "&blk34;": "\u2593",
  "&block;": "\u2588",
  "&bne;": "=\u20E5",
  "&bnequiv;": "\u2261\u20E5",
  "&bnot;": "\u2310",
  "&bopf;": "\u{1D553}",
  "&bot;": "\u22A5",
  "&bottom;": "\u22A5",
  "&bowtie;": "\u22C8",
  "&boxDL;": "\u2557",
  "&boxDR;": "\u2554",
  "&boxDl;": "\u2556",
  "&boxDr;": "\u2553",
  "&boxH;": "\u2550",
  "&boxHD;": "\u2566",
  "&boxHU;": "\u2569",
  "&boxHd;": "\u2564",
  "&boxHu;": "\u2567",
  "&boxUL;": "\u255D",
  "&boxUR;": "\u255A",
  "&boxUl;": "\u255C",
  "&boxUr;": "\u2559",
  "&boxV;": "\u2551",
  "&boxVH;": "\u256C",
  "&boxVL;": "\u2563",
  "&boxVR;": "\u2560",
  "&boxVh;": "\u256B",
  "&boxVl;": "\u2562",
  "&boxVr;": "\u255F",
  "&boxbox;": "\u29C9",
  "&boxdL;": "\u2555",
  "&boxdR;": "\u2552",
  "&boxdl;": "\u2510",
  "&boxdr;": "\u250C",
  "&boxh;": "\u2500",
  "&boxhD;": "\u2565",
  "&boxhU;": "\u2568",
  "&boxhd;": "\u252C",
  "&boxhu;": "\u2534",
  "&boxminus;": "\u229F",
  "&boxplus;": "\u229E",
  "&boxtimes;": "\u22A0",
  "&boxuL;": "\u255B",
  "&boxuR;": "\u2558",
  "&boxul;": "\u2518",
  "&boxur;": "\u2514",
  "&boxv;": "\u2502",
  "&boxvH;": "\u256A",
  "&boxvL;": "\u2561",
  "&boxvR;": "\u255E",
  "&boxvh;": "\u253C",
  "&boxvl;": "\u2524",
  "&boxvr;": "\u251C",
  "&bprime;": "\u2035",
  "&breve;": "\u02D8",
  "&brvbar": "\xA6",
  "&brvbar;": "\xA6",
  "&bscr;": "\u{1D4B7}",
  "&bsemi;": "\u204F",
  "&bsim;": "\u223D",
  "&bsime;": "\u22CD",
  "&bsol;": "\\",
  "&bsolb;": "\u29C5",
  "&bsolhsub;": "\u27C8",
  "&bull;": "\u2022",
  "&bullet;": "\u2022",
  "&bump;": "\u224E",
  "&bumpE;": "\u2AAE",
  "&bumpe;": "\u224F",
  "&bumpeq;": "\u224F",
  "&cacute;": "\u0107",
  "&cap;": "\u2229",
  "&capand;": "\u2A44",
  "&capbrcup;": "\u2A49",
  "&capcap;": "\u2A4B",
  "&capcup;": "\u2A47",
  "&capdot;": "\u2A40",
  "&caps;": "\u2229\uFE00",
  "&caret;": "\u2041",
  "&caron;": "\u02C7",
  "&ccaps;": "\u2A4D",
  "&ccaron;": "\u010D",
  "&ccedil": "\xE7",
  "&ccedil;": "\xE7",
  "&ccirc;": "\u0109",
  "&ccups;": "\u2A4C",
  "&ccupssm;": "\u2A50",
  "&cdot;": "\u010B",
  "&cedil": "\xB8",
  "&cedil;": "\xB8",
  "&cemptyv;": "\u29B2",
  "&cent": "\xA2",
  "&cent;": "\xA2",
  "&centerdot;": "\xB7",
  "&cfr;": "\u{1D520}",
  "&chcy;": "\u0447",
  "&check;": "\u2713",
  "&checkmark;": "\u2713",
  "&chi;": "\u03C7",
  "&cir;": "\u25CB",
  "&cirE;": "\u29C3",
  "&circ;": "\u02C6",
  "&circeq;": "\u2257",
  "&circlearrowleft;": "\u21BA",
  "&circlearrowright;": "\u21BB",
  "&circledR;": "\xAE",
  "&circledS;": "\u24C8",
  "&circledast;": "\u229B",
  "&circledcirc;": "\u229A",
  "&circleddash;": "\u229D",
  "&cire;": "\u2257",
  "&cirfnint;": "\u2A10",
  "&cirmid;": "\u2AEF",
  "&cirscir;": "\u29C2",
  "&clubs;": "\u2663",
  "&clubsuit;": "\u2663",
  "&colon;": ":",
  "&colone;": "\u2254",
  "&coloneq;": "\u2254",
  "&comma;": ",",
  "&commat;": "@",
  "&comp;": "\u2201",
  "&compfn;": "\u2218",
  "&complement;": "\u2201",
  "&complexes;": "\u2102",
  "&cong;": "\u2245",
  "&congdot;": "\u2A6D",
  "&conint;": "\u222E",
  "&copf;": "\u{1D554}",
  "&coprod;": "\u2210",
  "&copy": "\xA9",
  "&copy;": "\xA9",
  "&copysr;": "\u2117",
  "&crarr;": "\u21B5",
  "&cross;": "\u2717",
  "&cscr;": "\u{1D4B8}",
  "&csub;": "\u2ACF",
  "&csube;": "\u2AD1",
  "&csup;": "\u2AD0",
  "&csupe;": "\u2AD2",
  "&ctdot;": "\u22EF",
  "&cudarrl;": "\u2938",
  "&cudarrr;": "\u2935",
  "&cuepr;": "\u22DE",
  "&cuesc;": "\u22DF",
  "&cularr;": "\u21B6",
  "&cularrp;": "\u293D",
  "&cup;": "\u222A",
  "&cupbrcap;": "\u2A48",
  "&cupcap;": "\u2A46",
  "&cupcup;": "\u2A4A",
  "&cupdot;": "\u228D",
  "&cupor;": "\u2A45",
  "&cups;": "\u222A\uFE00",
  "&curarr;": "\u21B7",
  "&curarrm;": "\u293C",
  "&curlyeqprec;": "\u22DE",
  "&curlyeqsucc;": "\u22DF",
  "&curlyvee;": "\u22CE",
  "&curlywedge;": "\u22CF",
  "&curren": "\xA4",
  "&curren;": "\xA4",
  "&curvearrowleft;": "\u21B6",
  "&curvearrowright;": "\u21B7",
  "&cuvee;": "\u22CE",
  "&cuwed;": "\u22CF",
  "&cwconint;": "\u2232",
  "&cwint;": "\u2231",
  "&cylcty;": "\u232D",
  "&dArr;": "\u21D3",
  "&dHar;": "\u2965",
  "&dagger;": "\u2020",
  "&daleth;": "\u2138",
  "&darr;": "\u2193",
  "&dash;": "\u2010",
  "&dashv;": "\u22A3",
  "&dbkarow;": "\u290F",
  "&dblac;": "\u02DD",
  "&dcaron;": "\u010F",
  "&dcy;": "\u0434",
  "&dd;": "\u2146",
  "&ddagger;": "\u2021",
  "&ddarr;": "\u21CA",
  "&ddotseq;": "\u2A77",
  "&deg": "\xB0",
  "&deg;": "\xB0",
  "&delta;": "\u03B4",
  "&demptyv;": "\u29B1",
  "&dfisht;": "\u297F",
  "&dfr;": "\u{1D521}",
  "&dharl;": "\u21C3",
  "&dharr;": "\u21C2",
  "&diam;": "\u22C4",
  "&diamond;": "\u22C4",
  "&diamondsuit;": "\u2666",
  "&diams;": "\u2666",
  "&die;": "\xA8",
  "&digamma;": "\u03DD",
  "&disin;": "\u22F2",
  "&div;": "\xF7",
  "&divide": "\xF7",
  "&divide;": "\xF7",
  "&divideontimes;": "\u22C7",
  "&divonx;": "\u22C7",
  "&djcy;": "\u0452",
  "&dlcorn;": "\u231E",
  "&dlcrop;": "\u230D",
  "&dollar;": "$",
  "&dopf;": "\u{1D555}",
  "&dot;": "\u02D9",
  "&doteq;": "\u2250",
  "&doteqdot;": "\u2251",
  "&dotminus;": "\u2238",
  "&dotplus;": "\u2214",
  "&dotsquare;": "\u22A1",
  "&doublebarwedge;": "\u2306",
  "&downarrow;": "\u2193",
  "&downdownarrows;": "\u21CA",
  "&downharpoonleft;": "\u21C3",
  "&downharpoonright;": "\u21C2",
  "&drbkarow;": "\u2910",
  "&drcorn;": "\u231F",
  "&drcrop;": "\u230C",
  "&dscr;": "\u{1D4B9}",
  "&dscy;": "\u0455",
  "&dsol;": "\u29F6",
  "&dstrok;": "\u0111",
  "&dtdot;": "\u22F1",
  "&dtri;": "\u25BF",
  "&dtrif;": "\u25BE",
  "&duarr;": "\u21F5",
  "&duhar;": "\u296F",
  "&dwangle;": "\u29A6",
  "&dzcy;": "\u045F",
  "&dzigrarr;": "\u27FF",
  "&eDDot;": "\u2A77",
  "&eDot;": "\u2251",
  "&eacute": "\xE9",
  "&eacute;": "\xE9",
  "&easter;": "\u2A6E",
  "&ecaron;": "\u011B",
  "&ecir;": "\u2256",
  "&ecirc": "\xEA",
  "&ecirc;": "\xEA",
  "&ecolon;": "\u2255",
  "&ecy;": "\u044D",
  "&edot;": "\u0117",
  "&ee;": "\u2147",
  "&efDot;": "\u2252",
  "&efr;": "\u{1D522}",
  "&eg;": "\u2A9A",
  "&egrave": "\xE8",
  "&egrave;": "\xE8",
  "&egs;": "\u2A96",
  "&egsdot;": "\u2A98",
  "&el;": "\u2A99",
  "&elinters;": "\u23E7",
  "&ell;": "\u2113",
  "&els;": "\u2A95",
  "&elsdot;": "\u2A97",
  "&emacr;": "\u0113",
  "&empty;": "\u2205",
  "&emptyset;": "\u2205",
  "&emptyv;": "\u2205",
  "&emsp13;": "\u2004",
  "&emsp14;": "\u2005",
  "&emsp;": "\u2003",
  "&eng;": "\u014B",
  "&ensp;": "\u2002",
  "&eogon;": "\u0119",
  "&eopf;": "\u{1D556}",
  "&epar;": "\u22D5",
  "&eparsl;": "\u29E3",
  "&eplus;": "\u2A71",
  "&epsi;": "\u03B5",
  "&epsilon;": "\u03B5",
  "&epsiv;": "\u03F5",
  "&eqcirc;": "\u2256",
  "&eqcolon;": "\u2255",
  "&eqsim;": "\u2242",
  "&eqslantgtr;": "\u2A96",
  "&eqslantless;": "\u2A95",
  "&equals;": "=",
  "&equest;": "\u225F",
  "&equiv;": "\u2261",
  "&equivDD;": "\u2A78",
  "&eqvparsl;": "\u29E5",
  "&erDot;": "\u2253",
  "&erarr;": "\u2971",
  "&escr;": "\u212F",
  "&esdot;": "\u2250",
  "&esim;": "\u2242",
  "&eta;": "\u03B7",
  "&eth": "\xF0",
  "&eth;": "\xF0",
  "&euml": "\xEB",
  "&euml;": "\xEB",
  "&euro;": "\u20AC",
  "&excl;": "!",
  "&exist;": "\u2203",
  "&expectation;": "\u2130",
  "&exponentiale;": "\u2147",
  "&fallingdotseq;": "\u2252",
  "&fcy;": "\u0444",
  "&female;": "\u2640",
  "&ffilig;": "\uFB03",
  "&fflig;": "\uFB00",
  "&ffllig;": "\uFB04",
  "&ffr;": "\u{1D523}",
  "&filig;": "\uFB01",
  "&fjlig;": "fj",
  "&flat;": "\u266D",
  "&fllig;": "\uFB02",
  "&fltns;": "\u25B1",
  "&fnof;": "\u0192",
  "&fopf;": "\u{1D557}",
  "&forall;": "\u2200",
  "&fork;": "\u22D4",
  "&forkv;": "\u2AD9",
  "&fpartint;": "\u2A0D",
  "&frac12": "\xBD",
  "&frac12;": "\xBD",
  "&frac13;": "\u2153",
  "&frac14": "\xBC",
  "&frac14;": "\xBC",
  "&frac15;": "\u2155",
  "&frac16;": "\u2159",
  "&frac18;": "\u215B",
  "&frac23;": "\u2154",
  "&frac25;": "\u2156",
  "&frac34": "\xBE",
  "&frac34;": "\xBE",
  "&frac35;": "\u2157",
  "&frac38;": "\u215C",
  "&frac45;": "\u2158",
  "&frac56;": "\u215A",
  "&frac58;": "\u215D",
  "&frac78;": "\u215E",
  "&frasl;": "\u2044",
  "&frown;": "\u2322",
  "&fscr;": "\u{1D4BB}",
  "&gE;": "\u2267",
  "&gEl;": "\u2A8C",
  "&gacute;": "\u01F5",
  "&gamma;": "\u03B3",
  "&gammad;": "\u03DD",
  "&gap;": "\u2A86",
  "&gbreve;": "\u011F",
  "&gcirc;": "\u011D",
  "&gcy;": "\u0433",
  "&gdot;": "\u0121",
  "&ge;": "\u2265",
  "&gel;": "\u22DB",
  "&geq;": "\u2265",
  "&geqq;": "\u2267",
  "&geqslant;": "\u2A7E",
  "&ges;": "\u2A7E",
  "&gescc;": "\u2AA9",
  "&gesdot;": "\u2A80",
  "&gesdoto;": "\u2A82",
  "&gesdotol;": "\u2A84",
  "&gesl;": "\u22DB\uFE00",
  "&gesles;": "\u2A94",
  "&gfr;": "\u{1D524}",
  "&gg;": "\u226B",
  "&ggg;": "\u22D9",
  "&gimel;": "\u2137",
  "&gjcy;": "\u0453",
  "&gl;": "\u2277",
  "&glE;": "\u2A92",
  "&gla;": "\u2AA5",
  "&glj;": "\u2AA4",
  "&gnE;": "\u2269",
  "&gnap;": "\u2A8A",
  "&gnapprox;": "\u2A8A",
  "&gne;": "\u2A88",
  "&gneq;": "\u2A88",
  "&gneqq;": "\u2269",
  "&gnsim;": "\u22E7",
  "&gopf;": "\u{1D558}",
  "&grave;": "`",
  "&gscr;": "\u210A",
  "&gsim;": "\u2273",
  "&gsime;": "\u2A8E",
  "&gsiml;": "\u2A90",
  "&gt": ">",
  "&gt;": ">",
  "&gtcc;": "\u2AA7",
  "&gtcir;": "\u2A7A",
  "&gtdot;": "\u22D7",
  "&gtlPar;": "\u2995",
  "&gtquest;": "\u2A7C",
  "&gtrapprox;": "\u2A86",
  "&gtrarr;": "\u2978",
  "&gtrdot;": "\u22D7",
  "&gtreqless;": "\u22DB",
  "&gtreqqless;": "\u2A8C",
  "&gtrless;": "\u2277",
  "&gtrsim;": "\u2273",
  "&gvertneqq;": "\u2269\uFE00",
  "&gvnE;": "\u2269\uFE00",
  "&hArr;": "\u21D4",
  "&hairsp;": "\u200A",
  "&half;": "\xBD",
  "&hamilt;": "\u210B",
  "&hardcy;": "\u044A",
  "&harr;": "\u2194",
  "&harrcir;": "\u2948",
  "&harrw;": "\u21AD",
  "&hbar;": "\u210F",
  "&hcirc;": "\u0125",
  "&hearts;": "\u2665",
  "&heartsuit;": "\u2665",
  "&hellip;": "\u2026",
  "&hercon;": "\u22B9",
  "&hfr;": "\u{1D525}",
  "&hksearow;": "\u2925",
  "&hkswarow;": "\u2926",
  "&hoarr;": "\u21FF",
  "&homtht;": "\u223B",
  "&hookleftarrow;": "\u21A9",
  "&hookrightarrow;": "\u21AA",
  "&hopf;": "\u{1D559}",
  "&horbar;": "\u2015",
  "&hscr;": "\u{1D4BD}",
  "&hslash;": "\u210F",
  "&hstrok;": "\u0127",
  "&hybull;": "\u2043",
  "&hyphen;": "\u2010",
  "&iacute": "\xED",
  "&iacute;": "\xED",
  "&ic;": "\u2063",
  "&icirc": "\xEE",
  "&icirc;": "\xEE",
  "&icy;": "\u0438",
  "&iecy;": "\u0435",
  "&iexcl": "\xA1",
  "&iexcl;": "\xA1",
  "&iff;": "\u21D4",
  "&ifr;": "\u{1D526}",
  "&igrave": "\xEC",
  "&igrave;": "\xEC",
  "&ii;": "\u2148",
  "&iiiint;": "\u2A0C",
  "&iiint;": "\u222D",
  "&iinfin;": "\u29DC",
  "&iiota;": "\u2129",
  "&ijlig;": "\u0133",
  "&imacr;": "\u012B",
  "&image;": "\u2111",
  "&imagline;": "\u2110",
  "&imagpart;": "\u2111",
  "&imath;": "\u0131",
  "&imof;": "\u22B7",
  "&imped;": "\u01B5",
  "&in;": "\u2208",
  "&incare;": "\u2105",
  "&infin;": "\u221E",
  "&infintie;": "\u29DD",
  "&inodot;": "\u0131",
  "&int;": "\u222B",
  "&intcal;": "\u22BA",
  "&integers;": "\u2124",
  "&intercal;": "\u22BA",
  "&intlarhk;": "\u2A17",
  "&intprod;": "\u2A3C",
  "&iocy;": "\u0451",
  "&iogon;": "\u012F",
  "&iopf;": "\u{1D55A}",
  "&iota;": "\u03B9",
  "&iprod;": "\u2A3C",
  "&iquest": "\xBF",
  "&iquest;": "\xBF",
  "&iscr;": "\u{1D4BE}",
  "&isin;": "\u2208",
  "&isinE;": "\u22F9",
  "&isindot;": "\u22F5",
  "&isins;": "\u22F4",
  "&isinsv;": "\u22F3",
  "&isinv;": "\u2208",
  "&it;": "\u2062",
  "&itilde;": "\u0129",
  "&iukcy;": "\u0456",
  "&iuml": "\xEF",
  "&iuml;": "\xEF",
  "&jcirc;": "\u0135",
  "&jcy;": "\u0439",
  "&jfr;": "\u{1D527}",
  "&jmath;": "\u0237",
  "&jopf;": "\u{1D55B}",
  "&jscr;": "\u{1D4BF}",
  "&jsercy;": "\u0458",
  "&jukcy;": "\u0454",
  "&kappa;": "\u03BA",
  "&kappav;": "\u03F0",
  "&kcedil;": "\u0137",
  "&kcy;": "\u043A",
  "&kfr;": "\u{1D528}",
  "&kgreen;": "\u0138",
  "&khcy;": "\u0445",
  "&kjcy;": "\u045C",
  "&kopf;": "\u{1D55C}",
  "&kscr;": "\u{1D4C0}",
  "&lAarr;": "\u21DA",
  "&lArr;": "\u21D0",
  "&lAtail;": "\u291B",
  "&lBarr;": "\u290E",
  "&lE;": "\u2266",
  "&lEg;": "\u2A8B",
  "&lHar;": "\u2962",
  "&lacute;": "\u013A",
  "&laemptyv;": "\u29B4",
  "&lagran;": "\u2112",
  "&lambda;": "\u03BB",
  "&lang;": "\u27E8",
  "&langd;": "\u2991",
  "&langle;": "\u27E8",
  "&lap;": "\u2A85",
  "&laquo": "\xAB",
  "&laquo;": "\xAB",
  "&larr;": "\u2190",
  "&larrb;": "\u21E4",
  "&larrbfs;": "\u291F",
  "&larrfs;": "\u291D",
  "&larrhk;": "\u21A9",
  "&larrlp;": "\u21AB",
  "&larrpl;": "\u2939",
  "&larrsim;": "\u2973",
  "&larrtl;": "\u21A2",
  "&lat;": "\u2AAB",
  "&latail;": "\u2919",
  "&late;": "\u2AAD",
  "&lates;": "\u2AAD\uFE00",
  "&lbarr;": "\u290C",
  "&lbbrk;": "\u2772",
  "&lbrace;": "{",
  "&lbrack;": "[",
  "&lbrke;": "\u298B",
  "&lbrksld;": "\u298F",
  "&lbrkslu;": "\u298D",
  "&lcaron;": "\u013E",
  "&lcedil;": "\u013C",
  "&lceil;": "\u2308",
  "&lcub;": "{",
  "&lcy;": "\u043B",
  "&ldca;": "\u2936",
  "&ldquo;": "\u201C",
  "&ldquor;": "\u201E",
  "&ldrdhar;": "\u2967",
  "&ldrushar;": "\u294B",
  "&ldsh;": "\u21B2",
  "&le;": "\u2264",
  "&leftarrow;": "\u2190",
  "&leftarrowtail;": "\u21A2",
  "&leftharpoondown;": "\u21BD",
  "&leftharpoonup;": "\u21BC",
  "&leftleftarrows;": "\u21C7",
  "&leftrightarrow;": "\u2194",
  "&leftrightarrows;": "\u21C6",
  "&leftrightharpoons;": "\u21CB",
  "&leftrightsquigarrow;": "\u21AD",
  "&leftthreetimes;": "\u22CB",
  "&leg;": "\u22DA",
  "&leq;": "\u2264",
  "&leqq;": "\u2266",
  "&leqslant;": "\u2A7D",
  "&les;": "\u2A7D",
  "&lescc;": "\u2AA8",
  "&lesdot;": "\u2A7F",
  "&lesdoto;": "\u2A81",
  "&lesdotor;": "\u2A83",
  "&lesg;": "\u22DA\uFE00",
  "&lesges;": "\u2A93",
  "&lessapprox;": "\u2A85",
  "&lessdot;": "\u22D6",
  "&lesseqgtr;": "\u22DA",
  "&lesseqqgtr;": "\u2A8B",
  "&lessgtr;": "\u2276",
  "&lesssim;": "\u2272",
  "&lfisht;": "\u297C",
  "&lfloor;": "\u230A",
  "&lfr;": "\u{1D529}",
  "&lg;": "\u2276",
  "&lgE;": "\u2A91",
  "&lhard;": "\u21BD",
  "&lharu;": "\u21BC",
  "&lharul;": "\u296A",
  "&lhblk;": "\u2584",
  "&ljcy;": "\u0459",
  "&ll;": "\u226A",
  "&llarr;": "\u21C7",
  "&llcorner;": "\u231E",
  "&llhard;": "\u296B",
  "&lltri;": "\u25FA",
  "&lmidot;": "\u0140",
  "&lmoust;": "\u23B0",
  "&lmoustache;": "\u23B0",
  "&lnE;": "\u2268",
  "&lnap;": "\u2A89",
  "&lnapprox;": "\u2A89",
  "&lne;": "\u2A87",
  "&lneq;": "\u2A87",
  "&lneqq;": "\u2268",
  "&lnsim;": "\u22E6",
  "&loang;": "\u27EC",
  "&loarr;": "\u21FD",
  "&lobrk;": "\u27E6",
  "&longleftarrow;": "\u27F5",
  "&longleftrightarrow;": "\u27F7",
  "&longmapsto;": "\u27FC",
  "&longrightarrow;": "\u27F6",
  "&looparrowleft;": "\u21AB",
  "&looparrowright;": "\u21AC",
  "&lopar;": "\u2985",
  "&lopf;": "\u{1D55D}",
  "&loplus;": "\u2A2D",
  "&lotimes;": "\u2A34",
  "&lowast;": "\u2217",
  "&lowbar;": "_",
  "&loz;": "\u25CA",
  "&lozenge;": "\u25CA",
  "&lozf;": "\u29EB",
  "&lpar;": "(",
  "&lparlt;": "\u2993",
  "&lrarr;": "\u21C6",
  "&lrcorner;": "\u231F",
  "&lrhar;": "\u21CB",
  "&lrhard;": "\u296D",
  "&lrm;": "\u200E",
  "&lrtri;": "\u22BF",
  "&lsaquo;": "\u2039",
  "&lscr;": "\u{1D4C1}",
  "&lsh;": "\u21B0",
  "&lsim;": "\u2272",
  "&lsime;": "\u2A8D",
  "&lsimg;": "\u2A8F",
  "&lsqb;": "[",
  "&lsquo;": "\u2018",
  "&lsquor;": "\u201A",
  "&lstrok;": "\u0142",
  "&lt": "<",
  "&lt;": "<",
  "&ltcc;": "\u2AA6",
  "&ltcir;": "\u2A79",
  "&ltdot;": "\u22D6",
  "&lthree;": "\u22CB",
  "&ltimes;": "\u22C9",
  "&ltlarr;": "\u2976",
  "&ltquest;": "\u2A7B",
  "&ltrPar;": "\u2996",
  "&ltri;": "\u25C3",
  "&ltrie;": "\u22B4",
  "&ltrif;": "\u25C2",
  "&lurdshar;": "\u294A",
  "&luruhar;": "\u2966",
  "&lvertneqq;": "\u2268\uFE00",
  "&lvnE;": "\u2268\uFE00",
  "&mDDot;": "\u223A",
  "&macr": "\xAF",
  "&macr;": "\xAF",
  "&male;": "\u2642",
  "&malt;": "\u2720",
  "&maltese;": "\u2720",
  "&map;": "\u21A6",
  "&mapsto;": "\u21A6",
  "&mapstodown;": "\u21A7",
  "&mapstoleft;": "\u21A4",
  "&mapstoup;": "\u21A5",
  "&marker;": "\u25AE",
  "&mcomma;": "\u2A29",
  "&mcy;": "\u043C",
  "&mdash;": "\u2014",
  "&measuredangle;": "\u2221",
  "&mfr;": "\u{1D52A}",
  "&mho;": "\u2127",
  "&micro": "\xB5",
  "&micro;": "\xB5",
  "&mid;": "\u2223",
  "&midast;": "*",
  "&midcir;": "\u2AF0",
  "&middot": "\xB7",
  "&middot;": "\xB7",
  "&minus;": "\u2212",
  "&minusb;": "\u229F",
  "&minusd;": "\u2238",
  "&minusdu;": "\u2A2A",
  "&mlcp;": "\u2ADB",
  "&mldr;": "\u2026",
  "&mnplus;": "\u2213",
  "&models;": "\u22A7",
  "&mopf;": "\u{1D55E}",
  "&mp;": "\u2213",
  "&mscr;": "\u{1D4C2}",
  "&mstpos;": "\u223E",
  "&mu;": "\u03BC",
  "&multimap;": "\u22B8",
  "&mumap;": "\u22B8",
  "&nGg;": "\u22D9\u0338",
  "&nGt;": "\u226B\u20D2",
  "&nGtv;": "\u226B\u0338",
  "&nLeftarrow;": "\u21CD",
  "&nLeftrightarrow;": "\u21CE",
  "&nLl;": "\u22D8\u0338",
  "&nLt;": "\u226A\u20D2",
  "&nLtv;": "\u226A\u0338",
  "&nRightarrow;": "\u21CF",
  "&nVDash;": "\u22AF",
  "&nVdash;": "\u22AE",
  "&nabla;": "\u2207",
  "&nacute;": "\u0144",
  "&nang;": "\u2220\u20D2",
  "&nap;": "\u2249",
  "&napE;": "\u2A70\u0338",
  "&napid;": "\u224B\u0338",
  "&napos;": "\u0149",
  "&napprox;": "\u2249",
  "&natur;": "\u266E",
  "&natural;": "\u266E",
  "&naturals;": "\u2115",
  "&nbsp": "\xA0",
  "&nbsp;": "\xA0",
  "&nbump;": "\u224E\u0338",
  "&nbumpe;": "\u224F\u0338",
  "&ncap;": "\u2A43",
  "&ncaron;": "\u0148",
  "&ncedil;": "\u0146",
  "&ncong;": "\u2247",
  "&ncongdot;": "\u2A6D\u0338",
  "&ncup;": "\u2A42",
  "&ncy;": "\u043D",
  "&ndash;": "\u2013",
  "&ne;": "\u2260",
  "&neArr;": "\u21D7",
  "&nearhk;": "\u2924",
  "&nearr;": "\u2197",
  "&nearrow;": "\u2197",
  "&nedot;": "\u2250\u0338",
  "&nequiv;": "\u2262",
  "&nesear;": "\u2928",
  "&nesim;": "\u2242\u0338",
  "&nexist;": "\u2204",
  "&nexists;": "\u2204",
  "&nfr;": "\u{1D52B}",
  "&ngE;": "\u2267\u0338",
  "&nge;": "\u2271",
  "&ngeq;": "\u2271",
  "&ngeqq;": "\u2267\u0338",
  "&ngeqslant;": "\u2A7E\u0338",
  "&nges;": "\u2A7E\u0338",
  "&ngsim;": "\u2275",
  "&ngt;": "\u226F",
  "&ngtr;": "\u226F",
  "&nhArr;": "\u21CE",
  "&nharr;": "\u21AE",
  "&nhpar;": "\u2AF2",
  "&ni;": "\u220B",
  "&nis;": "\u22FC",
  "&nisd;": "\u22FA",
  "&niv;": "\u220B",
  "&njcy;": "\u045A",
  "&nlArr;": "\u21CD",
  "&nlE;": "\u2266\u0338",
  "&nlarr;": "\u219A",
  "&nldr;": "\u2025",
  "&nle;": "\u2270",
  "&nleftarrow;": "\u219A",
  "&nleftrightarrow;": "\u21AE",
  "&nleq;": "\u2270",
  "&nleqq;": "\u2266\u0338",
  "&nleqslant;": "\u2A7D\u0338",
  "&nles;": "\u2A7D\u0338",
  "&nless;": "\u226E",
  "&nlsim;": "\u2274",
  "&nlt;": "\u226E",
  "&nltri;": "\u22EA",
  "&nltrie;": "\u22EC",
  "&nmid;": "\u2224",
  "&nopf;": "\u{1D55F}",
  "&not": "\xAC",
  "&not;": "\xAC",
  "&notin;": "\u2209",
  "&notinE;": "\u22F9\u0338",
  "&notindot;": "\u22F5\u0338",
  "&notinva;": "\u2209",
  "&notinvb;": "\u22F7",
  "&notinvc;": "\u22F6",
  "&notni;": "\u220C",
  "&notniva;": "\u220C",
  "&notnivb;": "\u22FE",
  "&notnivc;": "\u22FD",
  "&npar;": "\u2226",
  "&nparallel;": "\u2226",
  "&nparsl;": "\u2AFD\u20E5",
  "&npart;": "\u2202\u0338",
  "&npolint;": "\u2A14",
  "&npr;": "\u2280",
  "&nprcue;": "\u22E0",
  "&npre;": "\u2AAF\u0338",
  "&nprec;": "\u2280",
  "&npreceq;": "\u2AAF\u0338",
  "&nrArr;": "\u21CF",
  "&nrarr;": "\u219B",
  "&nrarrc;": "\u2933\u0338",
  "&nrarrw;": "\u219D\u0338",
  "&nrightarrow;": "\u219B",
  "&nrtri;": "\u22EB",
  "&nrtrie;": "\u22ED",
  "&nsc;": "\u2281",
  "&nsccue;": "\u22E1",
  "&nsce;": "\u2AB0\u0338",
  "&nscr;": "\u{1D4C3}",
  "&nshortmid;": "\u2224",
  "&nshortparallel;": "\u2226",
  "&nsim;": "\u2241",
  "&nsime;": "\u2244",
  "&nsimeq;": "\u2244",
  "&nsmid;": "\u2224",
  "&nspar;": "\u2226",
  "&nsqsube;": "\u22E2",
  "&nsqsupe;": "\u22E3",
  "&nsub;": "\u2284",
  "&nsubE;": "\u2AC5\u0338",
  "&nsube;": "\u2288",
  "&nsubset;": "\u2282\u20D2",
  "&nsubseteq;": "\u2288",
  "&nsubseteqq;": "\u2AC5\u0338",
  "&nsucc;": "\u2281",
  "&nsucceq;": "\u2AB0\u0338",
  "&nsup;": "\u2285",
  "&nsupE;": "\u2AC6\u0338",
  "&nsupe;": "\u2289",
  "&nsupset;": "\u2283\u20D2",
  "&nsupseteq;": "\u2289",
  "&nsupseteqq;": "\u2AC6\u0338",
  "&ntgl;": "\u2279",
  "&ntilde": "\xF1",
  "&ntilde;": "\xF1",
  "&ntlg;": "\u2278",
  "&ntriangleleft;": "\u22EA",
  "&ntrianglelefteq;": "\u22EC",
  "&ntriangleright;": "\u22EB",
  "&ntrianglerighteq;": "\u22ED",
  "&nu;": "\u03BD",
  "&num;": "#",
  "&numero;": "\u2116",
  "&numsp;": "\u2007",
  "&nvDash;": "\u22AD",
  "&nvHarr;": "\u2904",
  "&nvap;": "\u224D\u20D2",
  "&nvdash;": "\u22AC",
  "&nvge;": "\u2265\u20D2",
  "&nvgt;": ">\u20D2",
  "&nvinfin;": "\u29DE",
  "&nvlArr;": "\u2902",
  "&nvle;": "\u2264\u20D2",
  "&nvlt;": "<\u20D2",
  "&nvltrie;": "\u22B4\u20D2",
  "&nvrArr;": "\u2903",
  "&nvrtrie;": "\u22B5\u20D2",
  "&nvsim;": "\u223C\u20D2",
  "&nwArr;": "\u21D6",
  "&nwarhk;": "\u2923",
  "&nwarr;": "\u2196",
  "&nwarrow;": "\u2196",
  "&nwnear;": "\u2927",
  "&oS;": "\u24C8",
  "&oacute": "\xF3",
  "&oacute;": "\xF3",
  "&oast;": "\u229B",
  "&ocir;": "\u229A",
  "&ocirc": "\xF4",
  "&ocirc;": "\xF4",
  "&ocy;": "\u043E",
  "&odash;": "\u229D",
  "&odblac;": "\u0151",
  "&odiv;": "\u2A38",
  "&odot;": "\u2299",
  "&odsold;": "\u29BC",
  "&oelig;": "\u0153",
  "&ofcir;": "\u29BF",
  "&ofr;": "\u{1D52C}",
  "&ogon;": "\u02DB",
  "&ograve": "\xF2",
  "&ograve;": "\xF2",
  "&ogt;": "\u29C1",
  "&ohbar;": "\u29B5",
  "&ohm;": "\u03A9",
  "&oint;": "\u222E",
  "&olarr;": "\u21BA",
  "&olcir;": "\u29BE",
  "&olcross;": "\u29BB",
  "&oline;": "\u203E",
  "&olt;": "\u29C0",
  "&omacr;": "\u014D",
  "&omega;": "\u03C9",
  "&omicron;": "\u03BF",
  "&omid;": "\u29B6",
  "&ominus;": "\u2296",
  "&oopf;": "\u{1D560}",
  "&opar;": "\u29B7",
  "&operp;": "\u29B9",
  "&oplus;": "\u2295",
  "&or;": "\u2228",
  "&orarr;": "\u21BB",
  "&ord;": "\u2A5D",
  "&order;": "\u2134",
  "&orderof;": "\u2134",
  "&ordf": "\xAA",
  "&ordf;": "\xAA",
  "&ordm": "\xBA",
  "&ordm;": "\xBA",
  "&origof;": "\u22B6",
  "&oror;": "\u2A56",
  "&orslope;": "\u2A57",
  "&orv;": "\u2A5B",
  "&oscr;": "\u2134",
  "&oslash": "\xF8",
  "&oslash;": "\xF8",
  "&osol;": "\u2298",
  "&otilde": "\xF5",
  "&otilde;": "\xF5",
  "&otimes;": "\u2297",
  "&otimesas;": "\u2A36",
  "&ouml": "\xF6",
  "&ouml;": "\xF6",
  "&ovbar;": "\u233D",
  "&par;": "\u2225",
  "&para": "\xB6",
  "&para;": "\xB6",
  "&parallel;": "\u2225",
  "&parsim;": "\u2AF3",
  "&parsl;": "\u2AFD",
  "&part;": "\u2202",
  "&pcy;": "\u043F",
  "&percnt;": "%",
  "&period;": ".",
  "&permil;": "\u2030",
  "&perp;": "\u22A5",
  "&pertenk;": "\u2031",
  "&pfr;": "\u{1D52D}",
  "&phi;": "\u03C6",
  "&phiv;": "\u03D5",
  "&phmmat;": "\u2133",
  "&phone;": "\u260E",
  "&pi;": "\u03C0",
  "&pitchfork;": "\u22D4",
  "&piv;": "\u03D6",
  "&planck;": "\u210F",
  "&planckh;": "\u210E",
  "&plankv;": "\u210F",
  "&plus;": "+",
  "&plusacir;": "\u2A23",
  "&plusb;": "\u229E",
  "&pluscir;": "\u2A22",
  "&plusdo;": "\u2214",
  "&plusdu;": "\u2A25",
  "&pluse;": "\u2A72",
  "&plusmn": "\xB1",
  "&plusmn;": "\xB1",
  "&plussim;": "\u2A26",
  "&plustwo;": "\u2A27",
  "&pm;": "\xB1",
  "&pointint;": "\u2A15",
  "&popf;": "\u{1D561}",
  "&pound": "\xA3",
  "&pound;": "\xA3",
  "&pr;": "\u227A",
  "&prE;": "\u2AB3",
  "&prap;": "\u2AB7",
  "&prcue;": "\u227C",
  "&pre;": "\u2AAF",
  "&prec;": "\u227A",
  "&precapprox;": "\u2AB7",
  "&preccurlyeq;": "\u227C",
  "&preceq;": "\u2AAF",
  "&precnapprox;": "\u2AB9",
  "&precneqq;": "\u2AB5",
  "&precnsim;": "\u22E8",
  "&precsim;": "\u227E",
  "&prime;": "\u2032",
  "&primes;": "\u2119",
  "&prnE;": "\u2AB5",
  "&prnap;": "\u2AB9",
  "&prnsim;": "\u22E8",
  "&prod;": "\u220F",
  "&profalar;": "\u232E",
  "&profline;": "\u2312",
  "&profsurf;": "\u2313",
  "&prop;": "\u221D",
  "&propto;": "\u221D",
  "&prsim;": "\u227E",
  "&prurel;": "\u22B0",
  "&pscr;": "\u{1D4C5}",
  "&psi;": "\u03C8",
  "&puncsp;": "\u2008",
  "&qfr;": "\u{1D52E}",
  "&qint;": "\u2A0C",
  "&qopf;": "\u{1D562}",
  "&qprime;": "\u2057",
  "&qscr;": "\u{1D4C6}",
  "&quaternions;": "\u210D",
  "&quatint;": "\u2A16",
  "&quest;": "?",
  "&questeq;": "\u225F",
  "&quot": '"',
  "&quot;": '"',
  "&rAarr;": "\u21DB",
  "&rArr;": "\u21D2",
  "&rAtail;": "\u291C",
  "&rBarr;": "\u290F",
  "&rHar;": "\u2964",
  "&race;": "\u223D\u0331",
  "&racute;": "\u0155",
  "&radic;": "\u221A",
  "&raemptyv;": "\u29B3",
  "&rang;": "\u27E9",
  "&rangd;": "\u2992",
  "&range;": "\u29A5",
  "&rangle;": "\u27E9",
  "&raquo": "\xBB",
  "&raquo;": "\xBB",
  "&rarr;": "\u2192",
  "&rarrap;": "\u2975",
  "&rarrb;": "\u21E5",
  "&rarrbfs;": "\u2920",
  "&rarrc;": "\u2933",
  "&rarrfs;": "\u291E",
  "&rarrhk;": "\u21AA",
  "&rarrlp;": "\u21AC",
  "&rarrpl;": "\u2945",
  "&rarrsim;": "\u2974",
  "&rarrtl;": "\u21A3",
  "&rarrw;": "\u219D",
  "&ratail;": "\u291A",
  "&ratio;": "\u2236",
  "&rationals;": "\u211A",
  "&rbarr;": "\u290D",
  "&rbbrk;": "\u2773",
  "&rbrace;": "}",
  "&rbrack;": "]",
  "&rbrke;": "\u298C",
  "&rbrksld;": "\u298E",
  "&rbrkslu;": "\u2990",
  "&rcaron;": "\u0159",
  "&rcedil;": "\u0157",
  "&rceil;": "\u2309",
  "&rcub;": "}",
  "&rcy;": "\u0440",
  "&rdca;": "\u2937",
  "&rdldhar;": "\u2969",
  "&rdquo;": "\u201D",
  "&rdquor;": "\u201D",
  "&rdsh;": "\u21B3",
  "&real;": "\u211C",
  "&realine;": "\u211B",
  "&realpart;": "\u211C",
  "&reals;": "\u211D",
  "&rect;": "\u25AD",
  "&reg": "\xAE",
  "&reg;": "\xAE",
  "&rfisht;": "\u297D",
  "&rfloor;": "\u230B",
  "&rfr;": "\u{1D52F}",
  "&rhard;": "\u21C1",
  "&rharu;": "\u21C0",
  "&rharul;": "\u296C",
  "&rho;": "\u03C1",
  "&rhov;": "\u03F1",
  "&rightarrow;": "\u2192",
  "&rightarrowtail;": "\u21A3",
  "&rightharpoondown;": "\u21C1",
  "&rightharpoonup;": "\u21C0",
  "&rightleftarrows;": "\u21C4",
  "&rightleftharpoons;": "\u21CC",
  "&rightrightarrows;": "\u21C9",
  "&rightsquigarrow;": "\u219D",
  "&rightthreetimes;": "\u22CC",
  "&ring;": "\u02DA",
  "&risingdotseq;": "\u2253",
  "&rlarr;": "\u21C4",
  "&rlhar;": "\u21CC",
  "&rlm;": "\u200F",
  "&rmoust;": "\u23B1",
  "&rmoustache;": "\u23B1",
  "&rnmid;": "\u2AEE",
  "&roang;": "\u27ED",
  "&roarr;": "\u21FE",
  "&robrk;": "\u27E7",
  "&ropar;": "\u2986",
  "&ropf;": "\u{1D563}",
  "&roplus;": "\u2A2E",
  "&rotimes;": "\u2A35",
  "&rpar;": ")",
  "&rpargt;": "\u2994",
  "&rppolint;": "\u2A12",
  "&rrarr;": "\u21C9",
  "&rsaquo;": "\u203A",
  "&rscr;": "\u{1D4C7}",
  "&rsh;": "\u21B1",
  "&rsqb;": "]",
  "&rsquo;": "\u2019",
  "&rsquor;": "\u2019",
  "&rthree;": "\u22CC",
  "&rtimes;": "\u22CA",
  "&rtri;": "\u25B9",
  "&rtrie;": "\u22B5",
  "&rtrif;": "\u25B8",
  "&rtriltri;": "\u29CE",
  "&ruluhar;": "\u2968",
  "&rx;": "\u211E",
  "&sacute;": "\u015B",
  "&sbquo;": "\u201A",
  "&sc;": "\u227B",
  "&scE;": "\u2AB4",
  "&scap;": "\u2AB8",
  "&scaron;": "\u0161",
  "&sccue;": "\u227D",
  "&sce;": "\u2AB0",
  "&scedil;": "\u015F",
  "&scirc;": "\u015D",
  "&scnE;": "\u2AB6",
  "&scnap;": "\u2ABA",
  "&scnsim;": "\u22E9",
  "&scpolint;": "\u2A13",
  "&scsim;": "\u227F",
  "&scy;": "\u0441",
  "&sdot;": "\u22C5",
  "&sdotb;": "\u22A1",
  "&sdote;": "\u2A66",
  "&seArr;": "\u21D8",
  "&searhk;": "\u2925",
  "&searr;": "\u2198",
  "&searrow;": "\u2198",
  "&sect": "\xA7",
  "&sect;": "\xA7",
  "&semi;": ";",
  "&seswar;": "\u2929",
  "&setminus;": "\u2216",
  "&setmn;": "\u2216",
  "&sext;": "\u2736",
  "&sfr;": "\u{1D530}",
  "&sfrown;": "\u2322",
  "&sharp;": "\u266F",
  "&shchcy;": "\u0449",
  "&shcy;": "\u0448",
  "&shortmid;": "\u2223",
  "&shortparallel;": "\u2225",
  "&shy": "\xAD",
  "&shy;": "\xAD",
  "&sigma;": "\u03C3",
  "&sigmaf;": "\u03C2",
  "&sigmav;": "\u03C2",
  "&sim;": "\u223C",
  "&simdot;": "\u2A6A",
  "&sime;": "\u2243",
  "&simeq;": "\u2243",
  "&simg;": "\u2A9E",
  "&simgE;": "\u2AA0",
  "&siml;": "\u2A9D",
  "&simlE;": "\u2A9F",
  "&simne;": "\u2246",
  "&simplus;": "\u2A24",
  "&simrarr;": "\u2972",
  "&slarr;": "\u2190",
  "&smallsetminus;": "\u2216",
  "&smashp;": "\u2A33",
  "&smeparsl;": "\u29E4",
  "&smid;": "\u2223",
  "&smile;": "\u2323",
  "&smt;": "\u2AAA",
  "&smte;": "\u2AAC",
  "&smtes;": "\u2AAC\uFE00",
  "&softcy;": "\u044C",
  "&sol;": "/",
  "&solb;": "\u29C4",
  "&solbar;": "\u233F",
  "&sopf;": "\u{1D564}",
  "&spades;": "\u2660",
  "&spadesuit;": "\u2660",
  "&spar;": "\u2225",
  "&sqcap;": "\u2293",
  "&sqcaps;": "\u2293\uFE00",
  "&sqcup;": "\u2294",
  "&sqcups;": "\u2294\uFE00",
  "&sqsub;": "\u228F",
  "&sqsube;": "\u2291",
  "&sqsubset;": "\u228F",
  "&sqsubseteq;": "\u2291",
  "&sqsup;": "\u2290",
  "&sqsupe;": "\u2292",
  "&sqsupset;": "\u2290",
  "&sqsupseteq;": "\u2292",
  "&squ;": "\u25A1",
  "&square;": "\u25A1",
  "&squarf;": "\u25AA",
  "&squf;": "\u25AA",
  "&srarr;": "\u2192",
  "&sscr;": "\u{1D4C8}",
  "&ssetmn;": "\u2216",
  "&ssmile;": "\u2323",
  "&sstarf;": "\u22C6",
  "&star;": "\u2606",
  "&starf;": "\u2605",
  "&straightepsilon;": "\u03F5",
  "&straightphi;": "\u03D5",
  "&strns;": "\xAF",
  "&sub;": "\u2282",
  "&subE;": "\u2AC5",
  "&subdot;": "\u2ABD",
  "&sube;": "\u2286",
  "&subedot;": "\u2AC3",
  "&submult;": "\u2AC1",
  "&subnE;": "\u2ACB",
  "&subne;": "\u228A",
  "&subplus;": "\u2ABF",
  "&subrarr;": "\u2979",
  "&subset;": "\u2282",
  "&subseteq;": "\u2286",
  "&subseteqq;": "\u2AC5",
  "&subsetneq;": "\u228A",
  "&subsetneqq;": "\u2ACB",
  "&subsim;": "\u2AC7",
  "&subsub;": "\u2AD5",
  "&subsup;": "\u2AD3",
  "&succ;": "\u227B",
  "&succapprox;": "\u2AB8",
  "&succcurlyeq;": "\u227D",
  "&succeq;": "\u2AB0",
  "&succnapprox;": "\u2ABA",
  "&succneqq;": "\u2AB6",
  "&succnsim;": "\u22E9",
  "&succsim;": "\u227F",
  "&sum;": "\u2211",
  "&sung;": "\u266A",
  "&sup1": "\xB9",
  "&sup1;": "\xB9",
  "&sup2": "\xB2",
  "&sup2;": "\xB2",
  "&sup3": "\xB3",
  "&sup3;": "\xB3",
  "&sup;": "\u2283",
  "&supE;": "\u2AC6",
  "&supdot;": "\u2ABE",
  "&supdsub;": "\u2AD8",
  "&supe;": "\u2287",
  "&supedot;": "\u2AC4",
  "&suphsol;": "\u27C9",
  "&suphsub;": "\u2AD7",
  "&suplarr;": "\u297B",
  "&supmult;": "\u2AC2",
  "&supnE;": "\u2ACC",
  "&supne;": "\u228B",
  "&supplus;": "\u2AC0",
  "&supset;": "\u2283",
  "&supseteq;": "\u2287",
  "&supseteqq;": "\u2AC6",
  "&supsetneq;": "\u228B",
  "&supsetneqq;": "\u2ACC",
  "&supsim;": "\u2AC8",
  "&supsub;": "\u2AD4",
  "&supsup;": "\u2AD6",
  "&swArr;": "\u21D9",
  "&swarhk;": "\u2926",
  "&swarr;": "\u2199",
  "&swarrow;": "\u2199",
  "&swnwar;": "\u292A",
  "&szlig": "\xDF",
  "&szlig;": "\xDF",
  "&target;": "\u2316",
  "&tau;": "\u03C4",
  "&tbrk;": "\u23B4",
  "&tcaron;": "\u0165",
  "&tcedil;": "\u0163",
  "&tcy;": "\u0442",
  "&tdot;": "\u20DB",
  "&telrec;": "\u2315",
  "&tfr;": "\u{1D531}",
  "&there4;": "\u2234",
  "&therefore;": "\u2234",
  "&theta;": "\u03B8",
  "&thetasym;": "\u03D1",
  "&thetav;": "\u03D1",
  "&thickapprox;": "\u2248",
  "&thicksim;": "\u223C",
  "&thinsp;": "\u2009",
  "&thkap;": "\u2248",
  "&thksim;": "\u223C",
  "&thorn": "\xFE",
  "&thorn;": "\xFE",
  "&tilde;": "\u02DC",
  "&times": "\xD7",
  "&times;": "\xD7",
  "&timesb;": "\u22A0",
  "&timesbar;": "\u2A31",
  "&timesd;": "\u2A30",
  "&tint;": "\u222D",
  "&toea;": "\u2928",
  "&top;": "\u22A4",
  "&topbot;": "\u2336",
  "&topcir;": "\u2AF1",
  "&topf;": "\u{1D565}",
  "&topfork;": "\u2ADA",
  "&tosa;": "\u2929",
  "&tprime;": "\u2034",
  "&trade;": "\u2122",
  "&triangle;": "\u25B5",
  "&triangledown;": "\u25BF",
  "&triangleleft;": "\u25C3",
  "&trianglelefteq;": "\u22B4",
  "&triangleq;": "\u225C",
  "&triangleright;": "\u25B9",
  "&trianglerighteq;": "\u22B5",
  "&tridot;": "\u25EC",
  "&trie;": "\u225C",
  "&triminus;": "\u2A3A",
  "&triplus;": "\u2A39",
  "&trisb;": "\u29CD",
  "&tritime;": "\u2A3B",
  "&trpezium;": "\u23E2",
  "&tscr;": "\u{1D4C9}",
  "&tscy;": "\u0446",
  "&tshcy;": "\u045B",
  "&tstrok;": "\u0167",
  "&twixt;": "\u226C",
  "&twoheadleftarrow;": "\u219E",
  "&twoheadrightarrow;": "\u21A0",
  "&uArr;": "\u21D1",
  "&uHar;": "\u2963",
  "&uacute": "\xFA",
  "&uacute;": "\xFA",
  "&uarr;": "\u2191",
  "&ubrcy;": "\u045E",
  "&ubreve;": "\u016D",
  "&ucirc": "\xFB",
  "&ucirc;": "\xFB",
  "&ucy;": "\u0443",
  "&udarr;": "\u21C5",
  "&udblac;": "\u0171",
  "&udhar;": "\u296E",
  "&ufisht;": "\u297E",
  "&ufr;": "\u{1D532}",
  "&ugrave": "\xF9",
  "&ugrave;": "\xF9",
  "&uharl;": "\u21BF",
  "&uharr;": "\u21BE",
  "&uhblk;": "\u2580",
  "&ulcorn;": "\u231C",
  "&ulcorner;": "\u231C",
  "&ulcrop;": "\u230F",
  "&ultri;": "\u25F8",
  "&umacr;": "\u016B",
  "&uml": "\xA8",
  "&uml;": "\xA8",
  "&uogon;": "\u0173",
  "&uopf;": "\u{1D566}",
  "&uparrow;": "\u2191",
  "&updownarrow;": "\u2195",
  "&upharpoonleft;": "\u21BF",
  "&upharpoonright;": "\u21BE",
  "&uplus;": "\u228E",
  "&upsi;": "\u03C5",
  "&upsih;": "\u03D2",
  "&upsilon;": "\u03C5",
  "&upuparrows;": "\u21C8",
  "&urcorn;": "\u231D",
  "&urcorner;": "\u231D",
  "&urcrop;": "\u230E",
  "&uring;": "\u016F",
  "&urtri;": "\u25F9",
  "&uscr;": "\u{1D4CA}",
  "&utdot;": "\u22F0",
  "&utilde;": "\u0169",
  "&utri;": "\u25B5",
  "&utrif;": "\u25B4",
  "&uuarr;": "\u21C8",
  "&uuml": "\xFC",
  "&uuml;": "\xFC",
  "&uwangle;": "\u29A7",
  "&vArr;": "\u21D5",
  "&vBar;": "\u2AE8",
  "&vBarv;": "\u2AE9",
  "&vDash;": "\u22A8",
  "&vangrt;": "\u299C",
  "&varepsilon;": "\u03F5",
  "&varkappa;": "\u03F0",
  "&varnothing;": "\u2205",
  "&varphi;": "\u03D5",
  "&varpi;": "\u03D6",
  "&varpropto;": "\u221D",
  "&varr;": "\u2195",
  "&varrho;": "\u03F1",
  "&varsigma;": "\u03C2",
  "&varsubsetneq;": "\u228A\uFE00",
  "&varsubsetneqq;": "\u2ACB\uFE00",
  "&varsupsetneq;": "\u228B\uFE00",
  "&varsupsetneqq;": "\u2ACC\uFE00",
  "&vartheta;": "\u03D1",
  "&vartriangleleft;": "\u22B2",
  "&vartriangleright;": "\u22B3",
  "&vcy;": "\u0432",
  "&vdash;": "\u22A2",
  "&vee;": "\u2228",
  "&veebar;": "\u22BB",
  "&veeeq;": "\u225A",
  "&vellip;": "\u22EE",
  "&verbar;": "|",
  "&vert;": "|",
  "&vfr;": "\u{1D533}",
  "&vltri;": "\u22B2",
  "&vnsub;": "\u2282\u20D2",
  "&vnsup;": "\u2283\u20D2",
  "&vopf;": "\u{1D567}",
  "&vprop;": "\u221D",
  "&vrtri;": "\u22B3",
  "&vscr;": "\u{1D4CB}",
  "&vsubnE;": "\u2ACB\uFE00",
  "&vsubne;": "\u228A\uFE00",
  "&vsupnE;": "\u2ACC\uFE00",
  "&vsupne;": "\u228B\uFE00",
  "&vzigzag;": "\u299A",
  "&wcirc;": "\u0175",
  "&wedbar;": "\u2A5F",
  "&wedge;": "\u2227",
  "&wedgeq;": "\u2259",
  "&weierp;": "\u2118",
  "&wfr;": "\u{1D534}",
  "&wopf;": "\u{1D568}",
  "&wp;": "\u2118",
  "&wr;": "\u2240",
  "&wreath;": "\u2240",
  "&wscr;": "\u{1D4CC}",
  "&xcap;": "\u22C2",
  "&xcirc;": "\u25EF",
  "&xcup;": "\u22C3",
  "&xdtri;": "\u25BD",
  "&xfr;": "\u{1D535}",
  "&xhArr;": "\u27FA",
  "&xharr;": "\u27F7",
  "&xi;": "\u03BE",
  "&xlArr;": "\u27F8",
  "&xlarr;": "\u27F5",
  "&xmap;": "\u27FC",
  "&xnis;": "\u22FB",
  "&xodot;": "\u2A00",
  "&xopf;": "\u{1D569}",
  "&xoplus;": "\u2A01",
  "&xotime;": "\u2A02",
  "&xrArr;": "\u27F9",
  "&xrarr;": "\u27F6",
  "&xscr;": "\u{1D4CD}",
  "&xsqcup;": "\u2A06",
  "&xuplus;": "\u2A04",
  "&xutri;": "\u25B3",
  "&xvee;": "\u22C1",
  "&xwedge;": "\u22C0",
  "&yacute": "\xFD",
  "&yacute;": "\xFD",
  "&yacy;": "\u044F",
  "&ycirc;": "\u0177",
  "&ycy;": "\u044B",
  "&yen": "\xA5",
  "&yen;": "\xA5",
  "&yfr;": "\u{1D536}",
  "&yicy;": "\u0457",
  "&yopf;": "\u{1D56A}",
  "&yscr;": "\u{1D4CE}",
  "&yucy;": "\u044E",
  "&yuml": "\xFF",
  "&yuml;": "\xFF",
  "&zacute;": "\u017A",
  "&zcaron;": "\u017E",
  "&zcy;": "\u0437",
  "&zdot;": "\u017C",
  "&zeetrf;": "\u2128",
  "&zeta;": "\u03B6",
  "&zfr;": "\u{1D537}",
  "&zhcy;": "\u0436",
  "&zigrarr;": "\u21DD",
  "&zopf;": "\u{1D56B}",
  "&zscr;": "\u{1D4CF}",
  "&zwj;": "\u200D",
  "&zwnj;": "\u200C"
};

// node_modules/postal-mime/dist/esm/text-format.js
var C1_ENTITY_REPLACEMENTS = /* @__PURE__ */ new Map([
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376]
]);
function decodeHTMLEntities(str) {
  return str.replace(/&(#\d+|#x[a-f0-9]+|[a-z]+\d*);?/gi, (match3, entity) => {
    if (typeof htmlEntities[match3] === "string") {
      return htmlEntities[match3];
    }
    if (entity.charAt(0) !== "#" || match3.charAt(match3.length - 1) !== ";") {
      return match3;
    }
    let codePoint;
    if (entity.charAt(1).toLowerCase() === "x") {
      codePoint = parseInt(entity.slice(2), 16);
    } else {
      codePoint = parseInt(entity.slice(1), 10);
    }
    let output = "";
    if (codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return "\uFFFD";
    }
    codePoint = C1_ENTITY_REPLACEMENTS.get(codePoint) ?? codePoint;
    if (codePoint > 65535) {
      codePoint -= 65536;
      output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    output += String.fromCharCode(codePoint);
    return output;
  });
}
var hexByte = (value) => value.toString(16).toUpperCase().padStart(2, "0");
function escapeHtml(str) {
  return str.trim().replace(/[<>"'?&]/g, (c) => "&#x" + hexByte(c.charCodeAt(0)) + ";");
}
var MAILTO_UNSAFE = /[^A-Za-z0-9\-._~!$'()*+,;:@]+/g;
var PERCENT_ENCODED = Array.from({ length: 256 }, (_, byte) => "%" + hexByte(byte));
function encodeMailto(address) {
  return address.replace(MAILTO_UNSAFE, (run) => Array.from(textEncoder.encode(run), (byte) => PERCENT_ENCODED[byte]).join(""));
}
function textToHtml(str) {
  let html = escapeHtml(str).replace(/\n/g, "<br />");
  return "<div>" + html + "</div>";
}
function createFinder(str, regex) {
  let searchedFrom = Infinity;
  let found = null;
  return (pos) => {
    if (pos < searchedFrom || found && pos > found.index) {
      regex.lastIndex = pos;
      found = regex.exec(str);
      searchedFrom = pos;
    }
    return found;
  };
}
function throughLastTag(str, process) {
  const end = str.lastIndexOf(">") + 1;
  return process(str.slice(0, end)) + str.slice(end);
}
function replaceClosedTags(str, pattern, replacement) {
  return throughLastTag(str, (head) => head.replace(pattern, replacement));
}
function replaceTags(str, prefix, pattern, replacement) {
  const parts = [];
  let copied = 0;
  let searchFrom = 0;
  while (true) {
    prefix.lastIndex = searchFrom;
    const candidate = prefix.exec(str);
    if (!candidate) {
      break;
    }
    const start = candidate.index;
    const gt = str.indexOf(">", start);
    if (gt < 0) {
      break;
    }
    pattern.lastIndex = start;
    const match3 = pattern.exec(str);
    if (!match3) {
      searchFrom = gt + 1;
      continue;
    }
    parts.push(str.slice(copied, start), replacement(...match3));
    copied = searchFrom = start + match3[0].length;
  }
  parts.push(str.slice(copied));
  return parts.join("");
}
function replaceBlocks(str, open, openToGt, close, closeToGt, replacement) {
  const nextGt = createFinder(str, />/g);
  const nextClose = createFinder(str, close);
  const parts = [];
  let copied = 0;
  let searchFrom = 0;
  while (true) {
    open.lastIndex = searchFrom;
    const opener = open.exec(str);
    if (!opener) {
      break;
    }
    const start = opener.index;
    searchFrom = start + 1;
    let from = start + opener[0].length;
    if (openToGt) {
      const gt = nextGt(from);
      if (!gt) {
        break;
      }
      from = gt.index + 1;
    }
    const closer = nextClose(from);
    if (!closer) {
      break;
    }
    let end = closer.index + closer[0].length;
    if (closeToGt) {
      const gt = nextGt(end);
      if (!gt) {
        break;
      }
      end = gt.index + 1;
    }
    parts.push(str.slice(copied, start), replacement);
    copied = searchFrom = end;
  }
  parts.push(str.slice(copied));
  return parts.join("");
}
function stripThroughLastTag(str, prefix) {
  const limit = str.lastIndexOf(">");
  let last = -1;
  prefix.lastIndex = 0;
  let match3;
  while ((match3 = prefix.exec(str)) && match3.index < limit) {
    last = match3.index;
  }
  return last < 0 ? str : str.slice(str.indexOf(">", last) + 1);
}
function stripFromFirstTag(str, prefix) {
  prefix.lastIndex = 0;
  const match3 = prefix.exec(str);
  return match3 && match3.index < str.lastIndexOf(">") ? str.slice(0, match3.index) : str;
}
function htmlToText(str) {
  str = str.replace(/\r\n|[\n\r\u2028\u2029]/g, "");
  str = replaceBlocks(str, /<!--/g, false, /-->/g, false, " ");
  str = replaceClosedTags(str, /<br\b[^>]*>/gi, "\n");
  str = replaceClosedTags(str, /<\/?(p|div|table|tr|td|th)\b[^>]*>/gi, "\n\n");
  str = replaceBlocks(str, /<script\b/gi, true, /<\/script\b/gi, true, " ");
  str = replaceBlocks(str, /<style\b/gi, true, /<\/style\b/gi, true, " ");
  str = stripThroughLastTag(str, /<body\b/gi);
  str = stripThroughLastTag(str, /<\/head\b/gi);
  str = stripThroughLastTag(str, /<!doctype\b/gi);
  str = stripFromFirstTag(str, /<\/body\b/gi);
  str = stripFromFirstTag(str, /<\/html\b/gi);
  str = throughLastTag(str, (head) => replaceTags(head, /<a\b/gi, /<a\b[^>]*href\s*=\s*["']?([^\s"']+)[^>]*>/iy, (match3, href) => ` (${href}) `));
  str = replaceClosedTags(str, /<\/?(span|em|i|strong|b|u|a)\b[^>]*>/gi, "");
  str = replaceTags(str, /<li\b/gi, /<li\b[^>]*>[\n\u0001\s]*/iy, () => "* ");
  str = replaceClosedTags(str, /<hr\b[^>]*>/g, "\n-------------\n");
  str = replaceClosedTags(str, /<[^>]*>/g, " ");
  str = str.replace(/\u0001/g, "\n").replace(/[ \t]+/g, " ").replace(/^\s+$/gm, "").replace(/\n\n+/g, "\n\n").replace(/^\n+/, "\n").replace(/\n+$/, "\n");
  str = decodeHTMLEntities(str);
  return str;
}
var dateFormatter = null;
function formatDate(date) {
  if (typeof Intl === "undefined") {
    return date;
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return date;
  }
  dateFormatter ??= new Intl.DateTimeFormat("default", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  return dateFormatter.format(parsed);
}
function formatTextAddress(address) {
  return (address.name ? [address.name, `<${address.address}>`] : [address.address]).join(" ");
}
function formatTextAddresses(addresses) {
  let parts = [];
  let processAddress = (address, partCounter) => {
    if (partCounter) {
      parts.push(", ");
    }
    if (address.group) {
      let groupStart = `${address.name}:`;
      let groupEnd = `;`;
      parts.push(groupStart);
      address.group.forEach(processAddress);
      parts.push(groupEnd);
    } else {
      parts.push(formatTextAddress(address));
    }
  };
  addresses.forEach(processAddress);
  return parts.join("");
}
function formatHtmlAddress(address) {
  return `<a href="mailto:${escapeHtml(encodeMailto(address.address))}" class="postal-email-address">${escapeHtml(address.name || `<${address.address}>`)}</a>`;
}
function formatHtmlAddresses(addresses) {
  let parts = [];
  let processAddress = (address, partCounter) => {
    if (partCounter) {
      parts.push('<span class="postal-email-address-separator">, </span>');
    }
    if (address.group) {
      let groupStart = `<span class="postal-email-address-group">${escapeHtml(address.name)}:</span>`;
      let groupEnd = `<span class="postal-email-address-group">;</span>`;
      parts.push(groupStart);
      address.group.forEach(processAddress);
      parts.push(groupEnd);
    } else {
      parts.push(formatHtmlAddress(address));
    }
  };
  addresses.forEach(processAddress);
  return parts.join(" ");
}
function foldLines(str, lineLength, afterSpace) {
  str = (str || "").toString();
  lineLength = lineLength || 76;
  let pos = 0, len = str.length, result = "", line, match3;
  while (pos < len) {
    line = str.slice(pos, pos + lineLength);
    if (line.length < lineLength) {
      result += line;
      break;
    }
    if (match3 = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
      line = match3[0];
      result += line;
      pos += line.length;
      continue;
    } else if ((match3 = line.match(/(\s+)[^\s]*$/)) && match3[0].length - (afterSpace ? (match3[1] || "").length : 0) < line.length) {
      line = line.slice(0, line.length - (match3[0].length - (afterSpace ? (match3[1] || "").length : 0)));
    } else if (match3 = str.slice(pos + line.length).match(/^[^\s]+(\s*)/)) {
      line = line + match3[0].slice(0, match3[0].length - (!afterSpace ? (match3[1] || "").length : 0));
    }
    result += line;
    pos += line.length;
    if (pos < len) {
      result += "\r\n";
    }
  }
  return result;
}
function formatTextHeader(message) {
  let rows = [];
  if (message.from) {
    rows.push({ key: "From", val: formatTextAddresses([message.from]) });
  }
  if (message.subject) {
    rows.push({ key: "Subject", val: message.subject });
  }
  if (message.date) {
    rows.push({ key: "Date", val: formatDate(message.date) });
  }
  if (message.to && message.to.length) {
    rows.push({ key: "To", val: formatTextAddresses(message.to) });
  }
  if (message.cc && message.cc.length) {
    rows.push({ key: "Cc", val: formatTextAddresses(message.cc) });
  }
  if (message.bcc && message.bcc.length) {
    rows.push({ key: "Bcc", val: formatTextAddresses(message.bcc) });
  }
  let maxKeyLength = rows.map((r) => r.key.length).reduce((acc, cur) => {
    return cur > acc ? cur : acc;
  }, 0);
  const lines = rows.flatMap((row) => {
    let sepLen = maxKeyLength - row.key.length;
    let prefix = `${row.key}: ${" ".repeat(sepLen)}`;
    let emptyPrefix = `${" ".repeat(row.key.length + 1)} ${" ".repeat(sepLen)}`;
    let foldedLines = foldLines(row.val, 80, true).split(/\r?\n/).map((line) => line.trim());
    return foldedLines.map((line, i) => `${i ? emptyPrefix : prefix}${line}`);
  });
  let maxLineLength = lines.map((r) => r.length).reduce((acc, cur) => {
    return cur > acc ? cur : acc;
  }, 0);
  let lineMarker = "-".repeat(maxLineLength);
  let template = `
${lineMarker}
${lines.join("\n")}
${lineMarker}
`;
  return template;
}
function formatHtmlHeader(message) {
  let rows = [];
  if (message.from) {
    rows.push(
      // through the plural formatter, because `From:` may hold RFC 5322 group syntax
      // and a group has no address of its own
      `<div class="postal-email-header-key">From</div><div class="postal-email-header-value">${formatHtmlAddresses([message.from])}</div>`
    );
  }
  if (message.subject) {
    rows.push(`<div class="postal-email-header-key">Subject</div><div class="postal-email-header-value postal-email-header-subject">${escapeHtml(message.subject)}</div>`);
  }
  if (message.date) {
    rows.push(`<div class="postal-email-header-key">Date</div><div class="postal-email-header-value postal-email-header-date" data-date="${escapeHtml(message.date)}">${escapeHtml(formatDate(message.date))}</div>`);
  }
  if (message.to && message.to.length) {
    rows.push(`<div class="postal-email-header-key">To</div><div class="postal-email-header-value">${formatHtmlAddresses(message.to)}</div>`);
  }
  if (message.cc && message.cc.length) {
    rows.push(`<div class="postal-email-header-key">Cc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.cc)}</div>`);
  }
  if (message.bcc && message.bcc.length) {
    rows.push(`<div class="postal-email-header-key">Bcc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.bcc)}</div>`);
  }
  let template = `<div class="postal-email-header">${rows.length ? '<div class="postal-email-header-row">' : ""}${rows.join('</div>\n<div class="postal-email-header-row">')}${rows.length ? "</div>" : ""}</div>`;
  return template;
}

// node_modules/postal-mime/dist/esm/address-parser.js
var TOKEN_OPERATOR = 1;
var TOKEN_NO_BREAK = 2;
var TOKEN_DIRTY = 4;
var TOKEN_ESCAPES = 8;
var TOKEN_STARTS_ESCAPED = 16;
var TOKEN_CONTROL = 32;
var TokenList = class {
  constructor(str) {
    this.str = str;
    this.slots = new Int32Array(48);
    this.length = 0;
    this.cleaned = /* @__PURE__ */ new Map();
  }
  /**
   * Appends a token
   *
   * @param kind Kind and flags of the token
   * @param start Offset of its first character
   * @param end Offset just past its last character
   * @return Index of the token
   */
  push(kind, start, end) {
    if ((this.length + 1) * 3 > this.slots.length) {
      const grown = new Int32Array(this.slots.length * 2);
      grown.set(this.slots);
      this.slots = grown;
    }
    const at = this.length * 3;
    this.slots[at] = kind;
    this.slots[at + 1] = start;
    this.slots[at + 2] = end;
    return this.length++;
  }
  /**
   * Offset of the first character of a token that is part of its value. A text run that is
   * no plain slice of the field still spans the whitespace and control characters its value
   * is trimmed of.
   */
  contentStart(index) {
    let start = this.slots[index * 3 + 1];
    const end = this.slots[index * 3 + 2];
    while (start < end && isDroppedCode(this.str.charCodeAt(start))) {
      start++;
    }
    return start;
  }
  /**
   * Offset just past the last character of a token that is part of its value
   */
  contentEnd(index) {
    const start = this.slots[index * 3 + 1];
    let end = this.slots[index * 3 + 2];
    while (end > start && isDroppedCode(this.str.charCodeAt(end - 1))) {
      end--;
    }
    return end;
  }
  /**
   * The character of an operator token, an empty string for a text run
   */
  operatorAt(index) {
    const at = index * 3;
    return this.slots[at] & TOKEN_OPERATOR ? this.str.charAt(this.slots[at + 1]) : "";
  }
  /**
   * Whether a token is an operator
   */
  isOperator(index) {
    return (this.slots[index * 3] & TOKEN_OPERATOR) !== 0;
  }
  /**
   * Whether the next character continues the run of a token without whitespace in between
   */
  noBreak(index) {
    return (this.slots[index * 3] & TOKEN_NO_BREAK) !== 0;
  }
  /**
   * Whether a control character was left out of the value of a token
   */
  hasControl(index) {
    return (this.slots[index * 3] & TOKEN_CONTROL) !== 0;
  }
  /**
   * Value of a token
   */
  value(index) {
    const cleaned = this.cleaned.get(index);
    if (cleaned !== void 0) {
      return cleaned;
    }
    return this.str.slice(this.slots[index * 3 + 1], this.slots[index * 3 + 2]);
  }
};
var HAS_WHITESPACE = /\s/;
var QUOTED_LOCAL_ADDR = /^("(?:[^"\\]|\\[\s\S])*"@\S+)(?:\s+([\s\S]+))?$/;
var ADDR_SPEC = /^[^@\s]+@[^@\s]+$/;
var LITERAL_ADDR_SPEC = /^[^@\s]+@\[[^[\]\\\s]*\]$/;
var QUOTED_LOCAL_DOMAIN = /^@(?:[^@\s"]+|\[[^[\]\\\s]*\])$/;
function isAddrSpec(value) {
  return ADDR_SPEC.test(value) || LITERAL_ADDR_SPEC.test(value);
}
var LOOSE_ADDR_SPEC = /^[^@\s]+@\S+$/;
var LOOSE_TEXT_ADDR = /\s*\b[^@\s]+@[^\s]+\b\s*/y;
var DOMAIN_LITERAL_TAIL = /@(\[[^[\]\\]*\])$/;
function domainAt(address) {
  const literal = address.charAt(address.length - 1) === "]" ? DOMAIN_LITERAL_TAIL.exec(address) : null;
  return literal ? address.length - literal[1].length - 1 : address.lastIndexOf("@");
}
function quoteLocalPart(address) {
  const lastAt = domainAt(address);
  if (lastAt < 0) {
    return address;
  }
  const user = address.substring(0, lastAt);
  if (/^[^\s"(),:;<>@[\\\]]+$/.test(user) || /^"(?:[^"\\]|\\[\s\S])*"$/.test(user)) {
    return address;
  }
  return '"' + user.replace(/["\\]/g, "\\$&") + '"@' + address.substring(lastAt + 1);
}
function isSpaceCode(code) {
  return code === 32 || code >= 9 && code <= 13 || code === 160 || code === 5760 || code >= 8192 && code <= 8202 || code === 8232 || code === 8233 || code === 8239 || code === 8287 || code === 12288 || code === 65279;
}
function isFoldingSpaceCode(code) {
  return code === 32 || code === 9 || code === 13 || code === 10;
}
function isFoldingGap(str, from, to) {
  for (let i = from; i < to; i++) {
    if (!isFoldingSpaceCode(str.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}
function isDroppedCode(code) {
  return code < 32 || code === 127 || isSpaceCode(code);
}
function isWordCode(code) {
  return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95;
}
function isBoundary(text, at) {
  return isWordCode(text.charCodeAt(at - 1)) !== isWordCode(text.charCodeAt(at));
}
function indexOfAt(text, from, to) {
  for (let i = from; i < to; i++) {
    if (text.charCodeAt(i) === 64) {
      return i;
    }
  }
  return -1;
}
var LEADING_QUOTED_STRING = /^"(?:[^"\\]|\\[\s\S])*"/;
function joinAtSpacing(value, at) {
  if (at < 0) {
    return value;
  }
  let start = at;
  while (start > 0 && isSpaceCode(value.charCodeAt(start - 1))) {
    start--;
  }
  let end = at + 1;
  while (end < value.length && isSpaceCode(value.charCodeAt(end))) {
    end++;
  }
  const joined = start === at && end === at + 1 ? value : value.slice(0, start) + "@" + value.slice(end);
  return joinDomainDotSpacing(joined, start);
}
var ASCII_ATEXT = new Uint8Array(128);
for (let code = 33; code < 127; code++) {
  ASCII_ATEXT[code] = '()<>[]:;@\\,."'.indexOf(String.fromCharCode(code)) < 0 ? 1 : 0;
}
function isAtextCode(code) {
  return code < 128 ? ASCII_ATEXT[code] === 1 : !isSpaceCode(code);
}
function joinDomainDotSpacing(value, at) {
  const len = value.length;
  let pos = at + 1;
  let spaced = false;
  for (; ; ) {
    const labelStart = pos;
    while (pos < len && isAtextCode(value.charCodeAt(pos))) {
      pos++;
    }
    if (pos === labelStart) {
      break;
    }
    let next = pos;
    while (next < len && isFoldingSpaceCode(value.charCodeAt(next))) {
      next++;
    }
    if (value.charCodeAt(next) !== 46) {
      break;
    }
    next++;
    while (next < len && isFoldingSpaceCode(value.charCodeAt(next))) {
      next++;
    }
    if (next >= len || !isAtextCode(value.charCodeAt(next))) {
      break;
    }
    spaced = spaced || next !== pos + 1;
    pos = next;
  }
  if (!spaced) {
    return value;
  }
  let domain = "";
  for (let k = at + 1; k < pos; k++) {
    if (!isFoldingSpaceCode(value.charCodeAt(k))) {
      domain += value.charAt(k);
    }
  }
  return value.slice(0, at + 1) + domain + value.slice(pos);
}
function collapseAtSpacing(value) {
  const quoted = LEADING_QUOTED_STRING.exec(value);
  if (quoted) {
    let at2 = quoted[0].length;
    while (at2 < value.length && isSpaceCode(value.charCodeAt(at2))) {
      at2++;
    }
    if (value.charAt(at2) === "@" && value.indexOf("@", at2 + 1) < 0) {
      return joinAtSpacing(value, at2);
    }
  }
  const at = value.indexOf("@");
  if (at < 0 || value.indexOf("@", at + 1) >= 0 || value.lastIndexOf('"') > at) {
    return value;
  }
  return joinAtSpacing(value, at);
}
function looseAddressStart(text) {
  const len = text.length;
  let pos = 0;
  while (pos < len) {
    while (pos < len && isSpaceCode(text.charCodeAt(pos))) {
      pos++;
    }
    if (pos >= len) {
      break;
    }
    const runStart = pos;
    let runEnd = pos;
    while (runEnd < len && !isSpaceCode(text.charCodeAt(runEnd))) {
      runEnd++;
    }
    let at = indexOfAt(text, runStart, runEnd);
    if (at >= 0) {
      let lastBoundary = -1;
      for (let k = runEnd; k > runStart; k--) {
        if (isBoundary(text, k)) {
          lastBoundary = k;
          break;
        }
      }
      let atomStart = runStart;
      while (lastBoundary >= 0 && at >= 0) {
        if (at > atomStart && runEnd > at + 1 && lastBoundary > at + 1) {
          for (let start = atomStart; start < at; start++) {
            if (isBoundary(text, start)) {
              if (start > runStart) {
                return start;
              }
              let padded = runStart;
              while (padded > 0 && isSpaceCode(text.charCodeAt(padded - 1))) {
                padded--;
              }
              return padded;
            }
          }
        }
        atomStart = at + 1;
        at = indexOfAt(text, atomStart, runEnd);
      }
    }
    pos = runEnd;
  }
  return -1;
}
function recoverAddrSpec(address, text) {
  address = collapseAtSpacing(address);
  if (!HAS_WHITESPACE.test(address)) {
    return { address, text };
  }
  let rest;
  const quoted = address.match(QUOTED_LOCAL_ADDR);
  if (quoted) {
    if (!quoted[2]) {
      return { address, text };
    }
    address = quoted[1];
    rest = [quoted[2]];
  } else {
    if (address.indexOf('"') >= 0) {
      return { address, text };
    }
    const parts = address.split(/\s+/);
    let addrIndex = parts.findIndex(isAddrSpec);
    if (addrIndex < 0) {
      addrIndex = parts.findIndex((part) => LOOSE_ADDR_SPEC.test(part));
    }
    if (addrIndex < 0) {
      return { address, text };
    }
    address = parts.splice(addrIndex, 1)[0];
    rest = parts;
  }
  return {
    address,
    text: [text, ...rest].filter((part) => part).join(" ")
  };
}
function stripAddressComments(address) {
  const comments = [];
  let result = "";
  let comment = "";
  let depth = 0;
  let closer = "";
  let lastChar = "";
  let pendingSpace = false;
  let firstChar = "";
  let quoteSeen = false;
  let routeEnd = -1;
  for (let i = 0, len = address.length; i < len; i++) {
    const chr = address.charAt(i);
    if (depth) {
      if (chr === "\\" && i < len - 1) {
        comment += address.charAt(++i);
      } else if (chr === "(") {
        depth++;
        comment += chr;
      } else if (chr === ")" && !--depth) {
        comments.push(comment.trim());
        comment = "";
        pendingSpace = lastChar !== "@";
      } else {
        comment += chr;
      }
      continue;
    }
    if (pendingSpace && chr !== "(") {
      pendingSpace = false;
      if (chr !== "@" && chr !== "<" && !isSpaceCode(address.charCodeAt(i))) {
        result += " ";
        lastChar = " ";
      }
    }
    if (closer) {
      if (chr === "\\" && closer === '"' && i < len - 1) {
        result += chr + address.charAt(++i);
        lastChar = address.charAt(i);
        continue;
      }
      if (chr === closer) {
        closer = "";
      }
    } else if (chr === '"') {
      closer = '"';
      quoteSeen = true;
    } else if (chr === ":" && routeEnd < 0 && firstChar === "@" && !quoteSeen) {
      routeEnd = result.length + 1;
    } else if (chr === "[") {
      closer = "]";
    } else if (chr === "(") {
      depth = 1;
      continue;
    } else if (chr === "<") {
      result = "";
      lastChar = "";
      comments.length = 0;
      firstChar = "";
      quoteSeen = false;
      routeEnd = -1;
      continue;
    }
    result += chr;
    lastChar = chr;
    if (!firstChar && !isSpaceCode(address.charCodeAt(i))) {
      firstChar = chr;
    }
  }
  if (routeEnd >= 0 && result.indexOf("@", routeEnd) >= 0) {
    result = result.slice(routeEnd);
  }
  if (depth) {
    comments.push(comment.trim());
  }
  return { address: result.trim(), comments: comments.filter((text) => text) };
}
function collectAddressParts(tokens, from, to) {
  let state = "text";
  let data = {
    address: [],
    comment: [],
    text: [],
    addressControl: [],
    textControl: [],
    textWasQuoted: [],
    // Track which text tokens came from inside quotes
    // For a text run that is a quoted local part followed by the unquoted '@' and domain
    // of an addr-spec, '"user"@example.com', the length of the local part, -1 otherwise
    quotedLocalAt: []
  };
  let lastTextPureQuoted = false;
  let lastTextHasAt = false;
  let lastTextOpen = false;
  let gapFrom = 0;
  let gapsFolding = true;
  let i;
  let insideQuotes = false;
  const lastChars = { address: "", comment: "", text: "" };
  for (i = from; i < to; i++) {
    const value = tokens.value(i);
    const prevOperator = i > from ? tokens.operatorAt(i - 1) : "";
    const prevNoBreak = i > from && tokens.noBreak(i - 1);
    if (tokens.isOperator(i)) {
      switch (value) {
        case "<":
          state = "address";
          insideQuotes = false;
          lastTextOpen = false;
          break;
        case "(":
          state = "comment";
          insideQuotes = false;
          gapsFolding = gapsFolding && isFoldingGap(tokens.str, gapFrom, tokens.contentStart(i));
          break;
        case '"':
          insideQuotes = !insideQuotes;
          state = "text";
          lastTextOpen = false;
          break;
        default:
          state = "text";
          insideQuotes = false;
          if (value !== ")") {
            lastTextOpen = false;
          } else {
            gapFrom = tokens.contentEnd(i);
          }
          break;
      }
    } else {
      const opensAfterEmptyQuotedString = prevOperator === '"' && prevNoBreak && i > from + 1 && tokens.operatorAt(i - 2) === '"';
      const secondAt = lastTextHasAt && prevOperator === ")" && value.indexOf("@") >= 0;
      const joinsDomain = !secondAt && lastTextOpen && lastTextHasAt && prevOperator === ")" && (lastChars.text === "." || value.charAt(0) === ".") && gapsFolding && isFoldingGap(tokens.str, gapFrom, tokens.contentStart(i));
      const joins = joinsDomain || !secondAt && prevNoBreak && data[state].length > 0 && (prevOperator !== ")" || lastChars[state] === "@" || value.charAt(0) === "@");
      if (joins) {
        const last = data[state].length - 1;
        if (state === "text" && !insideQuotes) {
          if (lastTextPureQuoted && value.charAt(0) === "@") {
            data.quotedLocalAt[last] = data.text[last].length;
          }
          lastTextPureQuoted = false;
        }
        data[state][last] += value;
        if (state === "text" && insideQuotes) {
          data.textWasQuoted[last] = true;
        }
        if (tokens.hasControl(i) && state !== "comment") {
          data[state === "text" ? "textControl" : "addressControl"][last] = true;
        }
      } else {
        data[state].push(value);
        if (state !== "comment") {
          data[state === "text" ? "textControl" : "addressControl"].push(tokens.hasControl(i));
        }
        if (state === "text") {
          data.textWasQuoted.push(insideQuotes || opensAfterEmptyQuotedString);
          data.quotedLocalAt.push(opensAfterEmptyQuotedString && value.charAt(0) === "@" ? 0 : -1);
          lastTextPureQuoted = insideQuotes;
        }
      }
      lastChars[state] = value.charAt(value.length - 1);
      if (state === "text") {
        lastTextHasAt = joins && lastTextHasAt || !insideQuotes && value.indexOf("@") >= 0;
        lastTextOpen = true;
        gapFrom = tokens.contentEnd(i);
        gapsFolding = true;
      }
    }
  }
  let textFromComment = false;
  if (!data.text.length && data.comment.length) {
    data.text = data.comment;
    data.textControl = data.comment.map(() => false);
    data.comment = [];
    textFromComment = true;
  }
  return { data, textFromComment };
}
function groupName(tokens, from, to) {
  return decodeWords(collectAddressParts(tokens, from, to).data.text.join(" "));
}
function _handleAddress(tokens, from, to) {
  const collected = collectAddressParts(tokens, from, to);
  const data = collected.data;
  let textFromComment = collected.textFromComment;
  let i;
  const addressComments = [];
  const addressParts = [];
  let addressControlled = false;
  data.address.forEach((part, index) => {
    const stripped = stripAddressComments(part);
    for (const comment of stripped.comments) {
      addressComments.push(comment);
    }
    if (stripped.address) {
      if (!addressParts.length) {
        addressControlled = data.addressControl[index];
      }
      addressParts.push(stripped.address);
    }
  });
  data.address = addressParts;
  if (!data.address.length && data.text.length && !textFromComment) {
    const candidates = data.text.map((part) => collapseAtSpacing(part));
    for (i = 0; i < data.text.length; i++) {
      const local = data.quotedLocalAt[i];
      const quotedLocal = data.textWasQuoted[i] && local >= 0 && QUOTED_LOCAL_DOMAIN.test(data.text[i].slice(local)) ? quoteLocalPart(data.text[i]) : "";
      if (quotedLocal || !data.textWasQuoted[i] && isAddrSpec(candidates[i])) {
        data.address = [quotedLocal || candidates[i]];
        addressControlled = data.textControl[i];
        data.text.splice(i, 1);
        data.textWasQuoted.splice(i, 1);
        data.quotedLocalAt.splice(i, 1);
        data.textControl.splice(i, 1);
        break;
      }
    }
    if (!data.address.length) {
      for (i = 0; i < data.text.length; i++) {
        if (!data.textWasQuoted[i]) {
          const part = candidates[i];
          const start = looseAddressStart(part);
          if (start >= 0) {
            LOOSE_TEXT_ADDR.lastIndex = start;
            const match3 = LOOSE_TEXT_ADDR.exec(part);
            if (match3) {
              data.address = [match3[0].trim()];
              addressControlled = data.textControl[i];
              data.text[i] = (part.slice(0, start) + " " + part.slice(start + match3[0].length)).trim();
              break;
            }
          }
          data.text[i] = data.text[i].trim();
        }
      }
    }
  }
  if (!data.text.length && data.comment.length) {
    data.text = data.comment;
    data.comment = [];
  }
  if (data.address.length > 1) {
    data.text = data.text.concat(data.address.splice(1));
  }
  const addressFromQuotedText = !data.address.length && data.textWasQuoted.some((wasQuoted) => wasQuoted);
  let text = data.text.join(" ");
  let addressValue = data.address.join(" ");
  if (!addressValue && isEncodedWordsOnly(text.trim())) {
    return { address: "", name: decodeWords(text) };
  }
  if (addressFromQuotedText && text.indexOf("@") >= 0) {
    addressValue = quoteLocalPart(joinAtSpacing(text, domainAt(text)));
    addressControlled = data.textControl.some(Boolean);
    text = "";
  }
  ({ address: addressValue, text } = recoverAddrSpec(addressValue, text));
  if (!text && addressComments.length) {
    text = addressComments.join(" ");
    textFromComment = true;
  }
  let mailbox = addressValue || (textFromComment ? "" : text) || "";
  let rawName = text || addressValue || "";
  if (mailbox && (addressControlled || !addressValue && data.textControl.some(Boolean))) {
    if (rawName === mailbox) {
      rawName = "";
    }
    mailbox = "";
  }
  const address = {
    address: mailbox,
    name: decodeWords(rawName)
  };
  if (address.address === rawName || address.address === address.name) {
    if (address.address.match(/@/)) {
      address.name = "";
    } else {
      address.address = "";
    }
  }
  return address;
}
var Tokenizer = class {
  /**
   * @param str Address field string
   */
  constructor(str) {
    this.str = (str || "").toString();
    this.operatorCurrent = "";
    this.operatorExpecting = "";
    this.node = -1;
    this.escaped = false;
    this.inDomainLiteral = false;
    this.afterAt = false;
    this.inGroup = false;
    this.innerQuoted = false;
    this.innerComment = 0;
    this.innerLiteral = false;
    this.innerEscaped = false;
    this.list = new TokenList(this.str);
    this.operators = {
      '"': '"',
      "(": ")",
      "<": ">",
      ",": "",
      // A group is read in the same pass as the rest of the list, so its ':' only marks
      // where the name ends and its members are tokenized like any other address
      ":": "",
      // Semicolons are not a legal delimiter per the RFC2822 grammar other
      // than for terminating a group, but they are also not valid for any
      // other use in this context.  Given that some mail clients have
      // historically allowed the semicolon as a delimiter equivalent to the
      // comma in their UI, it makes sense to treat them the same as a comma
      // when used outside of a group.
      ";": ""
    };
  }
  /**
   * Tokenizes the original input string
   *
   * @return An array of operator|text tokens
   */
  tokenize() {
    const str = this.str;
    const len = str.length;
    for (let i = 0; i < len; i++) {
      this.checkChar(str.charAt(i), i);
    }
    this.closeText(len);
    const list = this.list;
    const slots = list.slots;
    let kept = 0;
    for (let i = 0, count = list.length; i < count; i++) {
      const kind = slots[i * 3];
      let start = slots[i * 3 + 1];
      let end = slots[i * 3 + 2];
      if (kind & TOKEN_DIRTY) {
        const value = this.cleanValue(start, end, kind).trim();
        if (!value) {
          continue;
        }
        list.cleaned.set(kept, value);
      } else if (!(kind & TOKEN_OPERATOR)) {
        while (start < end && isSpaceCode(str.charCodeAt(start))) {
          start++;
        }
        while (end > start && isSpaceCode(str.charCodeAt(end - 1))) {
          end--;
        }
        if (start === end) {
          continue;
        }
      }
      slots[kept * 3] = kind;
      slots[kept * 3 + 1] = start;
      slots[kept * 3 + 2] = end;
      kept++;
    }
    list.length = kept;
    return list;
  }
  /**
   * Ends the text run being collected, if there is one
   *
   * @param end Offset just past its last character
   */
  closeText(end) {
    if (this.node >= 0) {
      this.list.slots[this.node * 3 + 2] = end;
      this.node = -1;
    }
  }
  /**
   * Rebuilds the value of a text run that is no plain slice of the field, applying the
   * rules checkChar collects characters by: an escaping backslash is dropped, a line break
   * reads as a space and any other control character is left out
   *
   * @param start Offset of the first character of the run
   * @param end Offset just past its last character
   * @param kind Kind and flags of the run
   * @return Value of the run
   */
  cleanValue(start, end, kind) {
    const str = this.str;
    const escapes = (kind & TOKEN_ESCAPES) !== 0;
    let escaped = (kind & TOKEN_STARTS_ESCAPED) !== 0;
    let value = "";
    for (let i = start; i < end; i++) {
      const chr = str.charAt(i);
      if (escapes && !escaped && chr === "\\") {
        escaped = true;
        continue;
      }
      escaped = false;
      if (chr === "\n") {
        value += " ";
      } else if (chr.charCodeAt(0) >= 33 || chr === " " || chr === "	") {
        value += chr;
      }
    }
    return value;
  }
  /**
   * Checks if a character is an operator or text and acts accordingly
   *
   * @param chr Character from the address field
   * @param i Offset of the character in the field
   */
  checkChar(chr, i) {
    if (!this.escaped && !this.operatorExpecting) {
      if (!this.inDomainLiteral && chr === "[" && this.afterAt) {
        this.inDomainLiteral = true;
      } else if (this.inDomainLiteral && (chr === "]" || chr === "," || chr === ";")) {
        this.inDomainLiteral = false;
      }
    }
    let nested = false;
    if (this.operatorExpecting === ">") {
      nested = this.trackInner(chr);
      if (!nested && chr === ";" && this.inGroup) {
        this.closeText(i);
        this.operatorExpecting = "";
        this.resetInner();
      }
    } else if (this.operatorExpecting === ")" && !this.escaped) {
      if (chr === "(") {
        this.innerComment++;
      } else if (chr === ")" && this.innerComment) {
        this.innerComment--;
        nested = true;
      }
    }
    if (this.escaped) {
    } else if (chr === this.operatorExpecting && !nested) {
      const nextChr = this.str.charAt(i + 1);
      this.closeText(i);
      this.list.push(nextChr && ![" ", "	", "\r", "\n", ",", ";"].includes(nextChr) ? TOKEN_OPERATOR | TOKEN_NO_BREAK : TOKEN_OPERATOR, i, i + 1);
      if (chr !== ")") {
        this.afterAt = false;
      }
      this.operatorExpecting = "";
      this.escaped = false;
      this.resetInner();
      return;
    } else if (!this.operatorExpecting && !(this.inDomainLiteral && chr === ":") && chr in this.operators) {
      this.closeText(i);
      this.list.push(TOKEN_OPERATOR, i, i + 1);
      if (chr === ":") {
        this.inGroup = true;
      } else if (chr === ";") {
        this.inGroup = false;
      }
      if (chr !== "(") {
        this.afterAt = false;
      }
      this.operatorExpecting = this.operators[chr];
      this.escaped = false;
      this.resetInner();
      return;
    } else if ((this.operatorExpecting === '"' || this.operatorExpecting === ")") && chr === "\\") {
      this.escaped = true;
      if (this.node >= 0) {
        this.list.slots[this.node * 3] |= TOKEN_DIRTY;
      }
      return;
    }
    if (this.node < 0) {
      this.node = this.list.push((this.operatorExpecting === '"' || this.operatorExpecting === ")" ? TOKEN_ESCAPES : 0) | (this.escaped ? TOKEN_STARTS_ESCAPED : 0), i, i);
    }
    if (chr === "\n") {
      chr = " ";
      this.list.slots[this.node * 3] |= TOKEN_DIRTY;
    }
    if (chr.charCodeAt(0) >= 33 || chr === " " || chr === "	") {
      if (!this.operatorExpecting && chr !== " " && chr !== "	") {
        this.afterAt = chr === "@";
      }
    } else {
      this.list.slots[this.node * 3] |= chr === "\r" ? TOKEN_DIRTY : TOKEN_DIRTY | TOKEN_CONTROL;
    }
    this.escaped = false;
  }
  /**
   * Tracks the quoted strings, comments and domain literals inside an angle-addr, which its
   * closer must not be read from. A backslash escapes the next character inside a quoted
   * string and a comment. A domain literal opens right after an "@" and ends at the "]".
   * dtext holds the list separators as well, and inside the brackets they never split the
   * list anyway.
   *
   * @param chr Character from the address field
   * @return true while the character sits inside one of them, the one that closes it included
   */
  trackInner(chr) {
    if (this.innerEscaped) {
      this.innerEscaped = false;
      return true;
    }
    if (this.innerQuoted) {
      if (chr === "\\") {
        this.innerEscaped = true;
      } else if (chr === '"') {
        this.innerQuoted = false;
      }
      return true;
    }
    if (this.innerComment) {
      if (chr === "\\") {
        this.innerEscaped = true;
      } else if (chr === "(") {
        this.innerComment++;
      } else if (chr === ")") {
        this.innerComment--;
      }
      return true;
    }
    if (this.innerLiteral) {
      if (chr === "]") {
        this.innerLiteral = false;
      }
      return true;
    }
    if (chr === '"') {
      this.innerQuoted = true;
      return true;
    }
    if (chr === "(") {
      this.innerComment = 1;
      return true;
    }
    if (chr === "[" && this.afterAt) {
      this.innerLiteral = true;
      return true;
    }
    if (!isSpaceCode(chr.charCodeAt(0))) {
      this.afterAt = chr === "@";
    }
    return false;
  }
  /**
   * Forgets the nesting collected for the operator that just opened or ended
   */
  resetInner() {
    this.innerQuoted = false;
    this.innerComment = 0;
    this.innerLiteral = false;
    this.innerEscaped = false;
  }
};
function mergeNameFragments(list) {
  const merged = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const current = list[i];
    const next = merged.length ? merged[merged.length - 1] : null;
    if (next && current.address === "" && current.name && !current.group && next.address && next.name) {
      next.name = current.name + ", " + next.name;
    } else {
      merged.push(current);
    }
  }
  return merged.reverse();
}
function parseAddressList(str) {
  const tokens = new Tokenizer(str).tokenize();
  const parsedAddresses = [];
  let group = null;
  let members = [];
  let from = 0;
  for (let i = 0, len = tokens.length; i <= len; i++) {
    const operator = i < len ? tokens.operatorAt(i) : "";
    if (i < len && operator !== "," && operator !== ";" && operator !== ":") {
      continue;
    }
    if (operator === ":") {
      if (!group) {
        group = { name: groupName(tokens, from, i), group: [] };
        members = [];
      }
      from = i + 1;
      continue;
    }
    if (i > from) {
      (group ? members : parsedAddresses).push(_handleAddress(tokens, from, i));
    }
    from = i + 1;
    if (group && (operator === ";" || i === len)) {
      group.group = mergeNameFragments(members);
      parsedAddresses.push(group);
      group = null;
    }
  }
  return mergeNameFragments(parsedAddresses);
}
function addressParser(str, options) {
  const parsedAddresses = parseAddressList(str);
  if (options && options.flatten) {
    let addresses = [];
    let walkAddressList = (list) => {
      list.forEach((address) => {
        if (address.group) {
          return walkAddressList(address.group);
        } else {
          addresses.push(address);
        }
      });
    };
    walkAddressList(parsedAddresses);
    return addresses;
  }
  return parsedAddresses;
}
var address_parser_default = addressParser;

// node_modules/postal-mime/dist/esm/base64-encoder.js
function base64ArrayBuffer(arrayBuffer) {
  let base64 = "";
  const encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new Uint8Array(arrayBuffer);
  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;
  let a, b, c, d;
  let chunk;
  for (let i = 0; i < mainLength; i = i + 3) {
    chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
    a = (chunk & 16515072) >> 18;
    b = (chunk & 258048) >> 12;
    c = (chunk & 4032) >> 6;
    d = chunk & 63;
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  }
  if (byteRemainder === 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    base64 += encodings[a] + encodings[b] + "==";
  } else if (byteRemainder === 2) {
    chunk = bytes[mainLength] << 8 | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    base64 += encodings[a] + encodings[b] + encodings[c] + "=";
  }
  return base64;
}

// node_modules/postal-mime/dist/esm/otp-token.js
var MAX_FIELD_LENGTH = 8192;
var NUMBER = /-?(?:\d{1,12}\.\d{1,3}|\d{1,15})/y;
var STRING = /"((?:[\x20\x21\x23-\x5b\x5d-\x7e]|\\["\\])*)"/y;
var TOKEN = /[A-Za-z*][!#$%&'*+\-.^_`|~0-9A-Za-z:/]*/y;
var BYTE_SEQUENCE = /:[A-Za-z0-9+/=]*:/y;
var BOOLEAN = /\?[01]/y;
var DATE = /@-?\d{1,15}/y;
var DISPLAY_STRING = /%"((?:[\x20\x21\x23\x24\x26-\x7e]|%[0-9a-f]{2})*)"/y;
var KEY = /[a-z*][a-z0-9_\-.*]*/y;
var SPACES = / */y;
function match2(cursor, re) {
  re.lastIndex = cursor.pos;
  const result = re.exec(cursor.input);
  if (result) {
    cursor.pos = re.lastIndex;
  }
  return result;
}
function parseString(cursor) {
  const result = match2(cursor, STRING);
  return result && result[1].replace(/\\(["\\])/g, "$1");
}
function isDisplayString(cursor) {
  const result = match2(cursor, DISPLAY_STRING);
  if (!result) {
    return false;
  }
  try {
    decodeURIComponent(result[1]);
    return true;
  } catch {
    return false;
  }
}
function parseBareItem(cursor) {
  const c = cursor.input.charAt(cursor.pos);
  switch (c) {
    case '"':
      return parseString(cursor) ?? false;
    case ":":
      return !!match2(cursor, BYTE_SEQUENCE);
    case "?":
      return !!match2(cursor, BOOLEAN);
    case "@":
      return !!match2(cursor, DATE);
    case "%":
      return isDisplayString(cursor);
  }
  return !!match2(cursor, c === "-" || c >= "0" && c <= "9" ? NUMBER : TOKEN);
}
function parseStringItem(value) {
  const cursor = { input: value, pos: 0 };
  match2(cursor, SPACES);
  const item = parseString(cursor);
  if (item === null) {
    return null;
  }
  const params = /* @__PURE__ */ new Map();
  while (cursor.input[cursor.pos] === ";") {
    cursor.pos++;
    match2(cursor, SPACES);
    const key = match2(cursor, KEY);
    if (!key) {
      return null;
    }
    let paramValue = true;
    if (cursor.input[cursor.pos] === "=") {
      cursor.pos++;
      paramValue = parseBareItem(cursor);
      if (paramValue === false) {
        return null;
      }
    }
    params.set(key[0], paramValue);
  }
  match2(cursor, SPACES);
  return cursor.pos === cursor.input.length ? { value: item, params } : null;
}
function isOtpOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin || !/^([a-z0-9_-]+\.)*[a-z0-9_-]+$|^\[[0-9a-f:.]+\]$/.test(url.hostname)) {
    return false;
  }
  const isLoopback = /^(localhost|.+\.localhost|127(\.\d+){3}|\[::1\])$/.test(url.hostname);
  return url.protocol === "https:" || url.protocol === "http:" && isLoopback;
}
function getOtp(headers) {
  let otpHeader;
  for (const header of headers) {
    if (header.key === "otp-token") {
      if (otpHeader) {
        return void 0;
      }
      otpHeader = header;
    }
  }
  if (!otpHeader || otpHeader.value.length > MAX_FIELD_LENGTH) {
    return void 0;
  }
  const parsed = parseStringItem(otpHeader.value);
  const origin = parsed?.params.get("origin");
  if (!parsed?.value || typeof origin !== "string" || !isOtpOrigin(origin)) {
    return void 0;
  }
  return { code: parsed.value, origin };
}

// node_modules/postal-mime/dist/esm/postal-mime.js
function isReadableStream(value) {
  return !!value && typeof value.getReader === "function";
}
function isBlob(value) {
  return value instanceof Blob || Object.prototype.toString.call(value) === "[object Blob]";
}
function isArrayBuffer(value) {
  const tag = Object.prototype.toString.call(value);
  return tag === "[object ArrayBuffer]" || tag === "[object SharedArrayBuffer]";
}
var ATTACHMENT_ENCODINGS = /* @__PURE__ */ new Set(["arraybuffer", "base64", "utf8"]);
function parseAttachmentEncoding(value) {
  const encoding = String(value || "").replace(/[-_\s]/g, "").toLowerCase() || "arraybuffer";
  if (!ATTACHMENT_ENCODINGS.has(encoding)) {
    throw createError("EINVALIDOPTION", `Unknown attachment encoding ${encoding}`);
  }
  return encoding;
}
function renderEntry(textEntry, textType, convert) {
  if (textEntry.type === "subMessage") {
    return textType === "html" ? formatHtmlHeader(textEntry.value) : formatTextHeader(textEntry.value);
  }
  if (!convert) {
    return textEntry.value;
  }
  return textType === "html" ? textToHtml(textEntry.value) : htmlToText(textEntry.value);
}
var LINE_FEED = new Uint8Array([10]);
var MAX_NESTING_DEPTH = 256;
var MAX_HEADERS_SIZE = 2 * 1024 * 1024;
var MAX_PART_COUNT = 1e4;
var MAX_RFC822_NESTING_DEPTH = 10;
var MAX_FORWARDED_ADDRESSES = 1e4;
function countAddresses(addresses) {
  if (!addresses) {
    return 0;
  }
  let count = 0;
  for (const address of Array.isArray(addresses) ? addresses : [addresses]) {
    count += 1 + (address.group ? address.group.length : 0);
  }
  return count;
}
function parseLimitOption(value, defaultValue, name, min = 0) {
  if (value === void 0 || value === null) {
    return defaultValue;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw createError("EINVALIDOPTION", `${name} must be a ${min ? "positive" : "non-negative"} integer`);
  }
  return value;
}
function parseLimits(options) {
  return {
    maxNestingDepth: parseLimitOption(options.maxNestingDepth, MAX_NESTING_DEPTH, "maxNestingDepth"),
    maxHeadersSize: parseLimitOption(options.maxHeadersSize, MAX_HEADERS_SIZE, "maxHeadersSize"),
    // The root part is always counted, so a limit of zero can parse nothing, not even
    // an empty message, and it threw EMAXPARTCOUNT from the constructor, where only
    // EINVALIDOPTION is thrown
    maxPartCount: parseLimitOption(options.maxPartCount, MAX_PART_COUNT, "maxPartCount", 1),
    // A limit of 0 disables inline parsing entirely, so every message/rfc822 part
    // becomes an attachment.
    maxRfc822NestingDepth: parseLimitOption(options.maxRfc822NestingDepth, MAX_RFC822_NESTING_DEPTH, "maxRfc822NestingDepth"),
    maxForwardedAddresses: parseLimitOption(options.maxForwardedAddresses, MAX_FORWARDED_ADDRESSES, "maxForwardedAddresses")
  };
}
var PostalMime = class _PostalMime {
  /**
   * Parses a raw email message
   *
   * @param buf Raw email message
   * @param options Parser options
   * @returns The parsed email
   */
  // async so that an invalid option rejects the returned promise instead of throwing
  // synchronously, which would escape a `.catch()` chain
  static async parse(buf, options) {
    const parser = new _PostalMime(options);
    return parser.parse(buf);
  }
  constructor(options, parent) {
    this.options = options || {};
    this.rfc822NestingDepth = parent ? parent.rfc822NestingDepth + 1 : 0;
    this.limits = parent ? parent.limits : parseLimits(this.options);
    this.counters = parent ? parent.counters : { headerSize: 0, partCount: 0, forwardedAddresses: 0 };
    this.root = this.currentNode = new MimeNode({ postalMime: this });
    this.boundaries = new BoundaryStack();
    this.textContent = {};
    this.textMap = /* @__PURE__ */ new Map();
    this.textTypes = /* @__PURE__ */ new Set();
    this.attachments = [];
    this.forceRfc822Attachments = false;
    this.attachmentEncoding = parseAttachmentEncoding(this.options.attachmentEncoding);
    this.started = false;
  }
  /** @internal */
  async finalize() {
    await this.root.finalize();
  }
  /** @internal */
  async processLine(line, lineBreak, isFinal) {
    const match3 = this.boundaries.match(line);
    if (match3) {
      if (match3.isTerminator) {
        await match3.node.finalize(true);
        this.currentNode = match3.node.parentNode || this.root;
      } else {
        await match3.node.finalizeChildNodes(true);
        this.currentNode = new MimeNode({
          postalMime: this,
          parentNode: match3.node,
          parentMultipartType: match3.node.contentType.multipart
        });
      }
      if (isFinal) {
        return this.finalize();
      }
      return;
    }
    if (this.currentNode.feed(line, lineBreak)) {
      return this.processLine(line, lineBreak, isFinal);
    }
    if (isFinal) {
      return this.finalize();
    }
  }
  // Reads the next line without its line break. The break itself, the exact bytes between
  // the line and the next one, is returned alongside, because the body decoders write it
  // back out: a part has to keep the line endings it was sent with, see PassThroughDecoder.
  /** @internal */
  readLine() {
    let startPos = this.readPos;
    let endPos = this.readPos;
    while (this.readPos < this.av.length) {
      const c = this.av[this.readPos++];
      if (c !== 13 && c !== 10) {
        endPos = this.readPos;
      }
      if (c === 10) {
        return {
          bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
          lineBreak: this.av.subarray(endPos, this.readPos),
          done: this.readPos >= this.av.length
        };
      }
    }
    return {
      bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
      lineBreak: LINE_FEED,
      done: this.readPos >= this.av.length
    };
  }
  // Records a text part or a nested message under the node that selects it
  /** @internal */
  addTextEntry(selector, textType, item) {
    let textEntry = this.textMap.get(selector);
    if (!textEntry) {
      textEntry = {};
      this.textMap.set(selector, textEntry);
    }
    const entries = textEntry[textType] || [];
    textEntry[textType] = entries;
    entries.push(item);
    this.textTypes.add(textType);
  }
  // Sorts every leaf of the tree into text content, nested messages and attachments.
  // `alternative` is the closest enclosing multipart/alternative, if any: its text parts
  // are collected under the alternative itself, so that the body is assembled from one
  // representation of it rather than from every one. `related` tells whether the part
  // sits inside a multipart/related, where a Content-ID makes it an inline resource
  /** @internal */
  async collectNode(node, alternative, related) {
    if (!node.contentType.multipart) {
      const inlineRfc822 = this.isInlineMessageRfc822(node);
      const rfc822DepthExceeded = inlineRfc822 && this.rfc822NestingDepth >= this.limits.maxRfc822NestingDepth;
      if (inlineRfc822 && !rfc822DepthExceeded) {
        await this.collectSubMessage(node);
      } else if (this.isInlineTextNode(node)) {
        const textType = node.contentType.parsed.value === "text/html" ? "html" : "plain";
        this.addTextEntry(alternative || node, textType, { type: "text", value: node.getTextContent() });
      } else if (node.content) {
        this.collectAttachment(node, node.content, related, rfc822DepthExceeded);
      }
    } else if (node.contentType.multipart === "alternative") {
      alternative = node;
    } else if (node.contentType.multipart === "related") {
      related = true;
    }
    for (let childNode of node.childNodes) {
      await this.collectNode(childNode, alternative, related);
    }
  }
  // Parses an inline message/rfc822 part with a nested parser and takes over its text
  // parts and attachments
  /** @internal */
  async collectSubMessage(node) {
    const subParser = new _PostalMime({
      // Options that decide how a part is classified stay with the parser that
      // was configured, the limits and their counters come from this parser.
      // Attachments are encoded by the parent parser, so raw buffers are kept here.
      attachmentEncoding: "arraybuffer"
    }, this);
    const subMessage = await subParser.parse(node.content || new ArrayBuffer(0));
    this.counters.forwardedAddresses += countAddresses(subMessage.from) + countAddresses(subMessage.to) + countAddresses(subMessage.cc) + countAddresses(subMessage.bcc);
    if (this.counters.forwardedAddresses > this.limits.maxForwardedAddresses) {
      throw createError("EMAXFORWARDEDADDRESSES", `Maximum forwarded address count of ${this.limits.maxForwardedAddresses} addresses exceeded`);
    }
    const hasPlain = subParser.textTypes.has("plain");
    const hasHtml = subParser.textTypes.has("html");
    if (hasPlain || !hasHtml) {
      this.addTextEntry(node, "plain", { type: "subMessage", value: subMessage });
    }
    if (hasHtml) {
      this.addTextEntry(node, "html", { type: "subMessage", value: subMessage });
    }
    subParser.textMap.forEach((subTextEntry, subTextNode) => {
      this.textMap.set(subTextNode, subTextEntry);
    });
    for (let attachment of subMessage.attachments) {
      this.attachments.push(attachment);
    }
  }
  /** @internal */
  collectAttachment(node, content, related, rfc822DepthExceeded) {
    const filename = node.contentDisposition.parsed.params.filename || node.contentType.parsed.params.name || null;
    const attachment = {
      // An RFC 2231 filename is percent decoded without folding, since the same decoder
      // produces the boundary, so the fold happens here, see foldLineBreaks
      filename: filename ? decodeWords(foldLineBreaks(filename)) : null,
      mimeType: node.contentType.parsed.value,
      disposition: node.contentDisposition.parsed.value || null
    };
    if (related && node.contentId && !rfc822DepthExceeded) {
      attachment.related = true;
    }
    if (rfc822DepthExceeded) {
      attachment.rfc822DepthExceeded = true;
    }
    if (node.contentDescription) {
      attachment.description = decodeWords(node.contentDescription);
    }
    if (node.contentId) {
      attachment.contentId = node.contentId;
    }
    switch (node.contentType.parsed.value) {
      // Special handling for calendar events
      case "text/calendar":
      case "application/ics": {
        if (node.contentType.parsed.params.method) {
          attachment.method = node.contentType.parsed.params.method.toString().toUpperCase().trim();
        }
        const decodedText = node.getTextContent();
        let end = decodedText.length;
        while (end > 0 && decodedText.charCodeAt(end - 1) === 10) {
          end--;
        }
        attachment.content = textEncoder.encode(decodedText.slice(0, end) + "\n");
        break;
      }
      // Regular attachments
      default:
        attachment.content = content;
    }
    this.attachments.push(attachment);
  }
  // Joins the collected text parts into the plain and html bodies
  /** @internal */
  renderTextContent() {
    const textContent = {};
    this.textMap.forEach((mapEntry) => {
      this.textTypes.forEach((textType) => {
        const output = textContent[textType] || [];
        textContent[textType] = output;
        const ownEntries = mapEntry[textType];
        const entries = ownEntries || mapEntry[textType === "html" ? "plain" : "html"] || [];
        for (const textEntry of entries) {
          output.push(renderEntry(textEntry, textType, !ownEntries));
        }
      });
    });
    Object.keys(textContent).forEach((textType) => {
      this.textContent[textType] = textContent[textType].join("\n");
    });
  }
  /** @internal */
  isInlineTextNode(node) {
    if (node.contentDisposition.parsed.value === "attachment") {
      return false;
    }
    switch (node.contentType.parsed.value) {
      case "text/html":
      case "text/plain":
        return true;
      case "text/calendar":
      case "text/csv":
      default:
        return false;
    }
  }
  /** @internal */
  isInlineMessageRfc822(node) {
    if (this.forceRfc822Attachments || node.contentType.parsed.value !== "message/rfc822") {
      return false;
    }
    const encoding = node.contentTransferEncoding.encoding;
    if (encoding === "base64" || encoding === "quoted-printable") {
      return false;
    }
    let disposition = node.contentDisposition.parsed.value || (this.options.rfc822Attachments ? "attachment" : "inline");
    return disposition === "inline";
  }
  // A delivery status or feedback report carries the offending message as a part. It is
  // evidence rather than content, so it is not inlined into the body of the report
  /** @internal */
  hasReportParts() {
    let found = false;
    let walk = (node) => {
      if (!node.contentType.multipart) {
        if (["message/delivery-status", "message/feedback-report"].includes(node.contentType.parsed.value)) {
          found = true;
        }
      }
      for (let childNode of node.childNodes) {
        walk(childNode);
      }
    };
    walk(this.root);
    return found;
  }
  /** @internal */
  async resolveStream(stream) {
    let chunkLen = 0;
    let chunks = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!ArrayBuffer.isView(value)) {
        const error = createError("EINVALIDINPUT", "Stream chunks must be Uint8Array values");
        reader.cancel(error).catch(() => {
        });
        throw error;
      }
      chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      chunkLen += value.byteLength;
    }
    const result = new Uint8Array(chunkLen);
    let chunkPointer = 0;
    for (let chunk of chunks) {
      result.set(chunk, chunkPointer);
      chunkPointer += chunk.length;
    }
    return result;
  }
  /** @internal */
  async resolveInput(buf) {
    let input = buf;
    if (isReadableStream(input)) {
      input = await this.resolveStream(input);
    }
    input = input || new ArrayBuffer(0);
    if (typeof input === "string") {
      input = textEncoder.encode(input);
    }
    if (isBlob(input)) {
      input = await blobToArrayBuffer(input);
    }
    if (ArrayBuffer.isView(input)) {
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    if (!isArrayBuffer(input)) {
      throw createError("EINVALIDINPUT", "Unsupported email input type");
    }
    return input;
  }
  // Properties are added in the order the output has always had them, so the required
  // ones are filled in below rather than in the literal
  /** @internal */
  buildMessage() {
    const headers = this.root.headers;
    const message = {
      headers: headers.map((entry) => ({
        key: entry.key,
        originalKey: entry.originalKey,
        value: entry.value
      }))
    };
    for (const key of ["from", "sender"]) {
      const addressHeader = headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        const addresses = address_parser_default(addressHeader.value);
        if (addresses && addresses.length) {
          message[key] = addresses[0];
        }
      }
    }
    for (const [key, camelKey] of [
      ["delivered-to", "deliveredTo"],
      ["return-path", "returnPath"]
    ]) {
      const addressHeader = headers.find((line) => line.key === key);
      if (addressHeader && addressHeader.value) {
        const addresses = address_parser_default(addressHeader.value);
        if (addresses && addresses.length && addresses[0].address) {
          message[camelKey] = addresses[0].address;
        }
      }
    }
    for (const [key, camelKey] of [
      ["to", "to"],
      ["cc", "cc"],
      ["bcc", "bcc"],
      ["reply-to", "replyTo"]
    ]) {
      const addresses = [];
      for (const entry of headers) {
        if (entry.key === key && entry.value) {
          for (const address of address_parser_default(entry.value)) {
            addresses.push(address);
          }
        }
      }
      if (addresses.length) {
        message[camelKey] = addresses;
      }
    }
    for (const [key, camelKey] of [
      ["subject", "subject"],
      ["message-id", "messageId"],
      ["in-reply-to", "inReplyTo"],
      ["references", "references"]
    ]) {
      const header = headers.find((line) => line.key === key);
      if (header && header.value) {
        message[camelKey] = decodeWords(header.value);
      }
    }
    let dateHeader = headers.find((line) => line.key === "date");
    if (dateHeader) {
      let date = new Date(dateHeader.value);
      message.date = date.toString() === "Invalid Date" ? dateHeader.value : date.toISOString();
    }
    const otp = getOtp(headers);
    if (otp) {
      message.otp = otp;
    }
    if (this.textContent.html) {
      message.html = this.textContent.html;
    }
    if (this.textContent.plain) {
      message.text = this.textContent.plain;
    }
    message.attachments = this.attachments;
    message.headerLines = this.root.rawHeaderLines.slice();
    return message;
  }
  // Every attachment holds binary content at this point, since nested parsers are
  // created with the arraybuffer encoding. The string check narrows the public content
  // type rather than handling a reachable case
  /** @internal */
  encodeAttachments() {
    switch (this.attachmentEncoding) {
      case "arraybuffer":
        break;
      case "base64":
        for (let attachment of this.attachments) {
          if (attachment.content && typeof attachment.content !== "string") {
            attachment.content = base64ArrayBuffer(attachment.content);
            attachment.encoding = "base64";
          }
        }
        break;
      case "utf8": {
        let attachmentDecoder = new TextDecoder("utf8");
        for (let attachment of this.attachments) {
          if (attachment.content && typeof attachment.content !== "string") {
            attachment.content = attachmentDecoder.decode(attachment.content);
            attachment.encoding = "utf8";
          }
        }
        break;
      }
    }
  }
  /**
   * Parses a raw email message. A parser instance can be used once
   *
   * @param buf Raw email message
   * @returns The parsed email
   */
  async parse(buf) {
    if (this.started) {
      throw createError("EPARSERREUSED", "Can not reuse parser, create a new PostalMime object");
    }
    this.started = true;
    this.buf = await this.resolveInput(buf);
    this.av = new Uint8Array(this.buf);
    this.readPos = 0;
    while (this.readPos < this.av.length) {
      const line = this.readLine();
      await this.processLine(line.bytes, line.lineBreak, line.done);
    }
    this.forceRfc822Attachments = Boolean(this.options.forceRfc822Attachments) || this.hasReportParts();
    await this.collectNode(this.root, false, false);
    if (this.rfc822NestingDepth === 0) {
      this.renderTextContent();
    }
    const message = this.buildMessage();
    this.encodeAttachments();
    return message;
  }
};

// src/utils/db.ts
function generateId() {
  return crypto.randomUUID();
}
function currentTimestamp() {
  return Math.floor(Date.now() / 1e3);
}
async function getSetting(db, key, defaultValue = "") {
  const result = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return result ? result.value : defaultValue;
}
async function setSetting(db, key, value, description) {
  await db.prepare(`
      INSERT INTO settings (key, value, description, updated_at) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, value, description || null, currentTimestamp()).run();
}

// src/services/storage.ts
var StorageService = class {
  /**
   * 保存附件（优先存入 R2，无 R2 则存入 D1 BLOB）
   */
  static async saveAttachment(env, input) {
    const attachmentId = generateId();
    const now = currentTimestamp();
    if (env.STORAGE) {
      const storageKey = `attachments/${input.emailId}/${attachmentId}-${input.filename}`;
      await env.STORAGE.put(storageKey, input.data, {
        httpMetadata: {
          contentType: input.contentType
        }
      });
      await env.DB.prepare(`
        INSERT INTO attachments (id, email_id, filename, content_type, size, storage_type, storage_key, created_at)
        VALUES (?, ?, ?, ?, ?, 'r2', ?, ?)
      `).bind(attachmentId, input.emailId, input.filename, input.contentType, input.size, storageKey, now).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO attachments (id, email_id, filename, content_type, size, storage_type, data_blob, created_at)
        VALUES (?, ?, ?, ?, ?, 'd1_blob', ?, ?)
      `).bind(attachmentId, input.emailId, input.filename, input.contentType, input.size, input.data, now).run();
    }
    return attachmentId;
  }
  /**
   * 获取附件数据
   */
  static async getAttachment(env, attachmentId) {
    const record = await env.DB.prepare(`
      SELECT id, filename, content_type, storage_type, storage_key, data_blob 
      FROM attachments WHERE id = ?
    `).bind(attachmentId).first();
    if (!record) return null;
    if (record.storage_type === "r2" && record.storage_key && env.STORAGE) {
      const object = await env.STORAGE.get(record.storage_key);
      if (!object) return null;
      return {
        filename: record.filename,
        contentType: record.content_type,
        data: object.body
      };
    } else if (record.data_blob) {
      return {
        filename: record.filename,
        contentType: record.content_type,
        data: record.data_blob
      };
    }
    return null;
  }
  /**
   * 删除邮件关联的所有附件
   */
  static async deleteEmailAttachments(env, emailId) {
    if (env.STORAGE) {
      const { results } = await env.DB.prepare(`
        SELECT storage_key FROM attachments WHERE email_id = ? AND storage_type = 'r2'
      `).bind(emailId).all();
      for (const item of results) {
        if (item.storage_key) {
          try {
            await env.STORAGE.delete(item.storage_key);
          } catch (e) {
            console.error("Failed to delete attachment from R2:", e);
          }
        }
      }
    }
    await env.DB.prepare("DELETE FROM attachments WHERE email_id = ?").bind(emailId).run();
  }
};

// src/email.ts
async function handleEmail(message, env, ctx) {
  try {
    const recipient = message.to.toLowerCase().trim();
    const sender = message.from.trim();
    let mailbox = await env.DB.prepare(`
      SELECT m.*, u.is_active as user_active, u.quota_bytes, u.used_bytes 
      FROM mailboxes m
      JOIN users u ON m.user_id = u.id
      WHERE LOWER(m.address) = ? AND m.is_active = 1 AND u.is_active = 1
    `).bind(recipient).first();
    if (!mailbox) {
      const domainPart = recipient.split("@")[1];
      const adminMailbox = await env.DB.prepare(`
        SELECT m.*, u.is_active as user_active, u.quota_bytes, u.used_bytes
        FROM mailboxes m
        JOIN users u ON m.user_id = u.id
        WHERE u.role = 'admin' AND u.is_active = 1 AND m.is_active = 1
        ORDER BY m.is_primary DESC
        LIMIT 1
      `).first();
      if (adminMailbox) {
        mailbox = adminMailbox;
      } else {
        console.warn(`[Email Routing] No active mailbox found for recipient: ${recipient}`);
        return;
      }
    }
    if (mailbox.used_bytes + message.rawSize > mailbox.quota_bytes) {
      console.warn(`[Email Routing] Mailbox quota exceeded for user ${mailbox.user_id}`);
    }
    const rawArrayBuffer = await new Response(message.raw).arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(rawArrayBuffer);
    const emailId = generateId();
    const now = currentTimestamp();
    const subject = parsed.subject || "(\u65E0\u4E3B\u9898)";
    const bodyText = parsed.text || "";
    const bodyHtml = parsed.html || (bodyText ? `<pre style="font-family: inherit; white-space: pre-wrap;">${bodyText}</pre>` : "");
    const snippet = (bodyText || subject).slice(0, 150).replace(/\s+/g, " ").trim();
    const fromName = parsed.from?.name || "";
    const fromAddress = parsed.from?.address || sender;
    const toAddresses = parsed.to && parsed.to.length > 0 ? parsed.to.map((t) => ({ name: t.name || "", address: t.address || "" })) : [{ name: "", address: recipient }];
    const ccAddresses = parsed.cc ? parsed.cc.map((c) => ({ name: c.name || "", address: c.address || "" })) : [];
    const bccAddresses = parsed.bcc ? parsed.bcc.map((b) => ({ name: b.name || "", address: b.address || "" })) : [];
    await env.DB.prepare(`
      INSERT INTO emails (
        id, mailbox_id, user_id, message_id, direction,
        from_name, from_address, to_addresses, cc_addresses, bcc_addresses,
        reply_to, subject, snippet, body_text, body_html, raw_size,
        is_read, is_starred, is_trash, is_spam, created_at
      ) VALUES (
        ?, ?, ?, ?, 'inbound',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        0, 0, 0, 0, ?
      )
    `).bind(
      emailId,
      mailbox.id,
      mailbox.user_id,
      parsed.messageId || null,
      fromName,
      fromAddress,
      JSON.stringify(toAddresses),
      ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
      bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
      parsed.replyTo && parsed.replyTo.length > 0 ? parsed.replyTo[0].address : null,
      subject,
      snippet,
      bodyText,
      bodyHtml,
      message.rawSize,
      now
    ).run();
    let totalAttachmentSize = 0;
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        let contentBytes = new Uint8Array(0);
        if (typeof att.content === "string") {
          contentBytes = new TextEncoder().encode(att.content);
        } else if (att.content) {
          contentBytes = att.content;
        }
        const attSize = contentBytes.byteLength;
        totalAttachmentSize += attSize;
        await StorageService.saveAttachment(env, {
          emailId,
          filename: att.filename || "attachment.dat",
          contentType: att.mimeType || "application/octet-stream",
          size: attSize,
          data: contentBytes
        });
      }
    }
    const addedBytes = message.rawSize + totalAttachmentSize;
    await env.DB.prepare(`
      UPDATE users 
      SET used_bytes = used_bytes + ?, updated_at = ? 
      WHERE id = ?
    `).bind(addedBytes, now, mailbox.user_id).run();
    console.log(`[Email Routing] Successfully saved email ${emailId} for mailbox ${mailbox.address}`);
  } catch (error) {
    console.error("[Email Routing] Failed to process incoming email:", error);
  }
}

// src/utils/crypto.ts
function generateSalt(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(password, hash, salt) {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}
async function getCryptoKey(secret) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
async function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );
  return `${data}.${encodedSignature}`;
}
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const key = await getCryptoKey(secret);
    const signatureStr = base64UrlDecode(signatureB64);
    const signatureBytes = new Uint8Array(signatureStr.split("").map((c) => c.charCodeAt(0)));
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(data)
    );
    if (!isValid) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && Date.now() / 1e3 > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// src/middleware/auth.ts
async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, error: "\u672A\u6388\u6743\uFF0C\u8BF7\u5148\u767B\u5F55" }, 401);
  }
  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET || "cfmail_super_secret_jwt_key_2026";
  const payload = await verifyJWT(token, secret);
  if (!payload || !payload.userId) {
    return c.json({ success: false, error: "\u767B\u5F55\u4F1A\u8BDD\u5DF2\u5931\u6548\u6216\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" }, 401);
  }
  const user = await c.env.DB.prepare("SELECT id, username, role, is_active FROM users WHERE id = ?").bind(payload.userId).first();
  if (!user || user.is_active !== 1) {
    return c.json({ success: false, error: "\u7528\u6237\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u7981\u7528" }, 403);
  }
  c.set("user", {
    id: user.id,
    username: user.username,
    role: user.role
  });
  await next();
}
async function adminMiddleware(c, next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ success: false, error: "\u6743\u9650\u4E0D\u8DB3\uFF0C\u4EC5\u7BA1\u7406\u5458\u53EF\u8BBF\u95EE" }, 403);
  }
  await next();
}

// src/routes/auth.ts
var authRouter = new Hono3();
authRouter.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, domainId, mailboxPrefix, inviteCode } = body;
    if (!username || !password) {
      return c.json({ success: false, error: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    if (username.length < 3 || username.length > 30) {
      return c.json({ success: false, error: "\u7528\u6237\u540D\u957F\u5EA6\u9700\u5728 3 \u5230 30 \u4E2A\u5B57\u7B26\u4E4B\u95F4" }, 400);
    }
    if (password.length < 6) {
      return c.json({ success: false, error: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11\u4E3A 6 \u4E2A\u5B57\u7B26" }, 400);
    }
    const userCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
    const isFirstUser = !userCount || userCount.count === 0;
    const allowReg = await getSetting(c.env.DB, "allow_registration", "true");
    if (!isFirstUser && allowReg === "false") {
      return c.json({ success: false, error: "\u7CFB\u7EDF\u5F53\u524D\u672A\u5F00\u653E\u81EA\u4E3B\u6CE8\u518C\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458" }, 403);
    }
    const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username.toLowerCase()).first();
    if (existingUser) {
      return c.json({ success: false, error: "\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u4F7F\u7528" }, 400);
    }
    let targetDomain = null;
    if (domainId) {
      targetDomain = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ? AND is_active = 1").bind(domainId).first();
    } else {
      targetDomain = await c.env.DB.prepare("SELECT * FROM domains WHERE is_active = 1 ORDER BY is_default DESC, created_at ASC LIMIT 1").first();
    }
    const prefix = (mailboxPrefix || username).trim().toLowerCase();
    if (!/^[a-zA-Z0-9._-]+$/.test(prefix)) {
      return c.json({ success: false, error: "\u90AE\u7BB1\u524D\u7F00\u53EA\u5141\u8BB8\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u53CA\u51CF\u53F7" }, 400);
    }
    const domainName = targetDomain ? targetDomain.domain_name : "localhost";
    const emailAddress = `${prefix}@${domainName}`.toLowerCase();
    const existingMailbox = await c.env.DB.prepare("SELECT id FROM mailboxes WHERE LOWER(address) = ?").bind(emailAddress).first();
    if (existingMailbox) {
      return c.json({ success: false, error: `\u90AE\u7BB1\u5730\u5740 ${emailAddress} \u5DF2\u88AB\u5360\u7528\uFF0C\u8BF7\u66F4\u6362\u524D\u7F00` }, 400);
    }
    const configuredInviteCode = c.env.ADMIN_INVITE_CODE || "admin888";
    const isAdmin = isFirstUser || inviteCode && inviteCode === configuredInviteCode;
    const role = isAdmin ? "admin" : "user";
    const defaultQuotaMb = await getSetting(c.env.DB, "default_quota_mb", "500");
    const quotaBytes = parseInt(defaultQuotaMb, 10) * 1024 * 1024;
    const userId = generateId();
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = currentTimestamp();
    await c.env.DB.prepare(`
      INSERT INTO users (id, username, password_hash, salt, role, is_active, quota_bytes, used_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
    `).bind(userId, username.toLowerCase(), passwordHash, salt, role, quotaBytes, now, now).run();
    const mailboxId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO mailboxes (id, user_id, address, domain_id, name, is_primary, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    `).bind(mailboxId, userId, emailAddress, targetDomain ? targetDomain.id : null, username, now).run();
    const secret = c.env.JWT_SECRET || "cfmail_super_secret_jwt_key_2026";
    const token = await signJWT(
      {
        userId,
        username,
        role,
        exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
        // 7 天
      },
      secret
    );
    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          username,
          role,
          primaryAddress: emailAddress
        }
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    return c.json({ success: false, error: "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 500);
  }
});
authRouter.post("/login", async (c) => {
  try {
    const { account, password } = await c.req.json();
    if (!account || !password) {
      return c.json({ success: false, error: "\u8D26\u53F7\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    const cleanAccount = account.trim().toLowerCase();
    let user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE LOWER(username) = ?
    `).bind(cleanAccount).first();
    if (!user) {
      const mailbox = await c.env.DB.prepare(`
        SELECT user_id FROM mailboxes WHERE LOWER(address) = ?
      `).bind(cleanAccount).first();
      if (mailbox) {
        user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(mailbox.user_id).first();
      }
    }
    if (!user) {
      return c.json({ success: false, error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
    }
    if (user.is_active !== 1) {
      return c.json({ success: false, error: "\u8BE5\u8D26\u53F7\u5DF2\u88AB\u7981\u7528\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458" }, 403);
    }
    const isValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return c.json({ success: false, error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
    }
    const primaryBox = await c.env.DB.prepare(`
      SELECT address FROM mailboxes WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1
    `).bind(user.id).first();
    const secret = c.env.JWT_SECRET || "cfmail_super_secret_jwt_key_2026";
    const token = await signJWT(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
      },
      secret
    );
    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          primaryAddress: primaryBox ? primaryBox.address : ""
        }
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ success: false, error: "\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 500);
  }
});
authRouter.get("/me", authMiddleware, async (c) => {
  const authUser = c.get("user");
  const user = await c.env.DB.prepare(`
    SELECT id, username, role, is_active, quota_bytes, used_bytes, created_at 
    FROM users WHERE id = ?
  `).bind(authUser.id).first();
  if (!user) {
    return c.json({ success: false, error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
  }
  const { results: mailboxes } = await c.env.DB.prepare(`
    SELECT id, address, name, is_primary, created_at 
    FROM mailboxes WHERE user_id = ? AND is_active = 1
    ORDER BY is_primary DESC, created_at ASC
  `).bind(user.id).all();
  return c.json({
    success: true,
    data: {
      ...user,
      mailboxes
    }
  });
});
authRouter.put("/password", authMiddleware, async (c) => {
  const authUser = c.get("user");
  const { oldPassword, newPassword } = await c.req.json();
  if (!oldPassword || !newPassword) {
    return c.json({ success: false, error: "\u539F\u5BC6\u7801\u548C\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (newPassword.length < 6) {
    return c.json({ success: false, error: "\u65B0\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11\u4E3A 6 \u4E2A\u5B57\u7B26" }, 400);
  }
  const user = await c.env.DB.prepare("SELECT password_hash, salt FROM users WHERE id = ?").bind(authUser.id).first();
  if (!user) {
    return c.json({ success: false, error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
  }
  const isOldValid = await verifyPassword(oldPassword, user.password_hash, user.salt);
  if (!isOldValid) {
    return c.json({ success: false, error: "\u539F\u5BC6\u7801\u4E0D\u6B63\u786E" }, 400);
  }
  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  await c.env.DB.prepare(`
    UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?
  `).bind(newHash, newSalt, currentTimestamp(), authUser.id).run();
  return c.json({ success: true, message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F" });
});
authRouter.get("/public-domains", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, domain_name, is_default, description 
    FROM domains WHERE is_active = 1 
    ORDER BY is_default DESC, created_at ASC
  `).all();
  return c.json({ success: true, data: results });
});

// src/routes/mailboxes.ts
var mailboxRouter = new Hono3();
mailboxRouter.use("*", authMiddleware);
mailboxRouter.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(`
    SELECT m.*, d.domain_name 
    FROM mailboxes m
    LEFT JOIN domains d ON m.domain_id = d.id
    WHERE m.user_id = ? AND m.is_active = 1
    ORDER BY m.is_primary DESC, m.created_at ASC
  `).bind(user.id).all();
  return c.json({ success: true, data: results });
});
mailboxRouter.post("/", async (c) => {
  try {
    const user = c.get("user");
    const { prefix, domainId, name } = await c.req.json();
    if (!prefix || !domainId) {
      return c.json({ success: false, error: "\u90AE\u7BB1\u524D\u7F00\u548C\u57DF\u540D\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    const cleanPrefix = prefix.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanPrefix)) {
      return c.json({ success: false, error: "\u90AE\u7BB1\u524D\u7F00\u53EA\u5141\u8BB8\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u53CA\u51CF\u53F7" }, 400);
    }
    const maxMailboxesStr = await getSetting(c.env.DB, "max_mailboxes_per_user", "5");
    const maxMailboxes = parseInt(maxMailboxesStr, 10);
    const countResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ?").bind(user.id).first();
    if (countResult && countResult.count >= maxMailboxes && user.role !== "admin") {
      return c.json({ success: false, error: `\u6BCF\u4E2A\u7528\u6237\u6700\u591A\u53EA\u5141\u8BB8\u521B\u5EFA ${maxMailboxes} \u4E2A\u90AE\u7BB1\u522B\u540D` }, 403);
    }
    const domain = await c.env.DB.prepare("SELECT id, domain_name FROM domains WHERE id = ? AND is_active = 1").bind(domainId).first();
    if (!domain) {
      return c.json({ success: false, error: "\u6240\u9009\u57DF\u540D\u4E0D\u5B58\u5728\u6216\u5DF2\u505C\u7528" }, 400);
    }
    const fullAddress = `${cleanPrefix}@${domain.domain_name}`.toLowerCase();
    const existing = await c.env.DB.prepare("SELECT id FROM mailboxes WHERE LOWER(address) = ?").bind(fullAddress).first();
    if (existing) {
      return c.json({ success: false, error: `\u90AE\u7BB1\u5730\u5740 ${fullAddress} \u5DF2\u88AB\u5360\u7528` }, 400);
    }
    const newId = generateId();
    const now = currentTimestamp();
    await c.env.DB.prepare(`
      INSERT INTO mailboxes (id, user_id, address, domain_id, name, is_primary, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?)
    `).bind(newId, user.id, fullAddress, domain.id, name || cleanPrefix, now).run();
    return c.json({
      success: true,
      data: {
        id: newId,
        address: fullAddress,
        domain_id: domain.id,
        domain_name: domain.domain_name,
        name: name || cleanPrefix,
        is_primary: 0
      }
    });
  } catch (error) {
    console.error("Create mailbox error:", error);
    return c.json({ success: false, error: "\u521B\u5EFA\u90AE\u7BB1\u522B\u540D\u5931\u8D25" }, 500);
  }
});
mailboxRouter.put("/:id/primary", async (c) => {
  const user = c.get("user");
  const mailboxId = c.req.param("id");
  const mailbox = await c.env.DB.prepare("SELECT id FROM mailboxes WHERE id = ? AND user_id = ?").bind(mailboxId, user.id).first();
  if (!mailbox) {
    return c.json({ success: false, error: "\u90AE\u7BB1\u4E0D\u5B58\u5728" }, 404);
  }
  await c.env.DB.prepare("UPDATE mailboxes SET is_primary = 0 WHERE user_id = ?").bind(user.id).run();
  await c.env.DB.prepare("UPDATE mailboxes SET is_primary = 1 WHERE id = ?").bind(mailboxId).run();
  return c.json({ success: true, message: "\u5DF2\u8BBE\u4E3A\u4E3B\u90AE\u7BB1" });
});
mailboxRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const mailboxId = c.req.param("id");
  const mailbox = await c.env.DB.prepare("SELECT id, is_primary FROM mailboxes WHERE id = ? AND user_id = ?").bind(mailboxId, user.id).first();
  if (!mailbox) {
    return c.json({ success: false, error: "\u90AE\u7BB1\u4E0D\u5B58\u5728" }, 404);
  }
  if (mailbox.is_primary === 1) {
    return c.json({ success: false, error: "\u4E3B\u90AE\u7BB1\u4E0D\u5141\u8BB8\u76F4\u63A5\u5220\u9664\uFF0C\u8BF7\u5148\u5C06\u5176\u4ED6\u90AE\u7BB1\u8BBE\u4E3A\u4E3B\u90AE\u7BB1" }, 400);
  }
  await c.env.DB.prepare("DELETE FROM mailboxes WHERE id = ?").bind(mailboxId).run();
  return c.json({ success: true, message: "\u90AE\u7BB1\u522B\u540D\u5DF2\u5220\u9664" });
});

// src/routes/emails.ts
var emailRouter = new Hono3();
emailRouter.use("*", authMiddleware);
emailRouter.get("/stats", async (c) => {
  const user = c.get("user");
  const inboxUnread = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND direction = 'inbound' AND is_trash = 0 AND is_read = 0
  `).bind(user.id).first();
  const inboxTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND direction = 'inbound' AND is_trash = 0
  `).bind(user.id).first();
  const sentTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND direction = 'outbound' AND is_trash = 0
  `).bind(user.id).first();
  const starredTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND is_starred = 1 AND is_trash = 0
  `).bind(user.id).first();
  const trashTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND is_trash = 1
  `).bind(user.id).first();
  return c.json({
    success: true,
    data: {
      inboxUnread: inboxUnread?.count || 0,
      inboxTotal: inboxTotal?.count || 0,
      sentTotal: sentTotal?.count || 0,
      starredTotal: starredTotal?.count || 0,
      trashTotal: trashTotal?.count || 0
    }
  });
});
emailRouter.get("/", async (c) => {
  const user = c.get("user");
  const folder = c.req.query("folder") || "inbox";
  const mailboxId = c.req.query("mailbox_id");
  const search = c.req.query("search")?.trim();
  const unreadOnly = c.req.query("unread") === "true";
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));
  const offset = (page - 1) * limit;
  let whereClauses = ["e.user_id = ?"];
  let params = [user.id];
  if (mailboxId) {
    whereClauses.push("e.mailbox_id = ?");
    params.push(mailboxId);
  }
  if (folder === "trash") {
    whereClauses.push("e.is_trash = 1");
  } else {
    whereClauses.push("e.is_trash = 0");
    if (folder === "starred") {
      whereClauses.push("e.is_starred = 1");
    } else if (folder === "sent") {
      whereClauses.push("e.direction = 'outbound'");
    } else {
      whereClauses.push("e.direction = 'inbound'");
    }
  }
  if (unreadOnly) {
    whereClauses.push("e.is_read = 0");
  }
  if (search) {
    whereClauses.push("(e.subject LIKE ? OR e.from_address LIKE ? OR e.snippet LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = whereClauses.join(" AND ");
  const totalCountResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails e WHERE ${whereSql}
  `).bind(...params).first();
  const total = totalCountResult?.count || 0;
  const querySql = `
    SELECT 
      e.id, e.mailbox_id, e.direction, e.from_name, e.from_address,
      e.to_addresses, e.subject, e.snippet, e.is_read, e.is_starred,
      e.is_trash, e.created_at, e.raw_size,
      m.address as mailbox_address,
      (SELECT COUNT(*) FROM attachments a WHERE a.email_id = e.id) as attachment_count
    FROM emails e
    LEFT JOIN mailboxes m ON e.mailbox_id = m.id
    WHERE ${whereSql}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const { results } = await c.env.DB.prepare(querySql).bind(...params, limit, offset).all();
  return c.json({
    success: true,
    data: {
      items: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});
emailRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const emailId = c.req.param("id");
  const email = await c.env.DB.prepare(`
    SELECT e.*, m.address as mailbox_address
    FROM emails e
    LEFT JOIN mailboxes m ON e.mailbox_id = m.id
    WHERE e.id = ? AND e.user_id = ?
  `).bind(emailId, user.id).first();
  if (!email) {
    return c.json({ success: false, error: "\u90AE\u4EF6\u4E0D\u5B58\u5728" }, 404);
  }
  if (email.is_read === 0) {
    await c.env.DB.prepare("UPDATE emails SET is_read = 1 WHERE id = ?").bind(emailId).run();
    email.is_read = 1;
  }
  const { results: attachments } = await c.env.DB.prepare(`
    SELECT id, filename, content_type, size, created_at 
    FROM attachments WHERE email_id = ?
  `).bind(emailId).all();
  return c.json({
    success: true,
    data: {
      ...email,
      to_addresses: JSON.parse(email.to_addresses || "[]"),
      cc_addresses: email.cc_addresses ? JSON.parse(email.cc_addresses) : [],
      bcc_addresses: email.bcc_addresses ? JSON.parse(email.bcc_addresses) : [],
      attachments
    }
  });
});
emailRouter.patch("/:id/read", async (c) => {
  const user = c.get("user");
  const emailId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const isRead = typeof body.is_read === "boolean" ? body.is_read ? 1 : 0 : null;
  if (isRead !== null) {
    await c.env.DB.prepare("UPDATE emails SET is_read = ? WHERE id = ? AND user_id = ?").bind(isRead, emailId, user.id).run();
  } else {
    await c.env.DB.prepare("UPDATE emails SET is_read = 1 - is_read WHERE id = ? AND user_id = ?").bind(emailId, user.id).run();
  }
  return c.json({ success: true });
});
emailRouter.patch("/:id/star", async (c) => {
  const user = c.get("user");
  const emailId = c.req.param("id");
  await c.env.DB.prepare("UPDATE emails SET is_starred = 1 - is_starred WHERE id = ? AND user_id = ?").bind(emailId, user.id).run();
  return c.json({ success: true });
});
emailRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const emailId = c.req.param("id");
  const email = await c.env.DB.prepare("SELECT id, is_trash, raw_size FROM emails WHERE id = ? AND user_id = ?").bind(emailId, user.id).first();
  if (!email) {
    return c.json({ success: false, error: "\u90AE\u4EF6\u4E0D\u5B58\u5728" }, 404);
  }
  if (email.is_trash === 0) {
    await c.env.DB.prepare("UPDATE emails SET is_trash = 1 WHERE id = ?").bind(emailId).run();
    return c.json({ success: true, message: "\u90AE\u4EF6\u5DF2\u79FB\u5165\u5783\u573E\u7BB1" });
  } else {
    const { results: atts } = await c.env.DB.prepare("SELECT size FROM attachments WHERE email_id = ?").bind(emailId).all();
    const totalAttSize = atts.reduce((sum, item) => sum + item.size, 0);
    const freedBytes = email.raw_size + totalAttSize;
    await StorageService.deleteEmailAttachments(c.env, emailId);
    await c.env.DB.prepare("DELETE FROM emails WHERE id = ?").bind(emailId).run();
    await c.env.DB.prepare(`
      UPDATE users 
      SET used_bytes = MAX(0, used_bytes - ?), updated_at = ? 
      WHERE id = ?
    `).bind(freedBytes, currentTimestamp(), user.id).run();
    return c.json({ success: true, message: "\u90AE\u4EF6\u5DF2\u5F7B\u5E95\u5220\u9664" });
  }
});
emailRouter.post("/:id/restore", async (c) => {
  const user = c.get("user");
  const emailId = c.req.param("id");
  await c.env.DB.prepare("UPDATE emails SET is_trash = 0 WHERE id = ? AND user_id = ?").bind(emailId, user.id).run();
  return c.json({ success: true, message: "\u90AE\u4EF6\u5DF2\u6062\u590D" });
});
emailRouter.get("/:id/attachments/:attachmentId", async (c) => {
  const user = c.get("user");
  const emailId = c.req.param("id");
  const attachmentId = c.req.param("attachmentId");
  const email = await c.env.DB.prepare("SELECT id FROM emails WHERE id = ? AND user_id = ?").bind(emailId, user.id).first();
  if (!email) {
    return c.json({ success: false, error: "\u65E0\u6743\u8BBF\u95EE\u8BE5\u9644\u4EF6" }, 403);
  }
  const att = await StorageService.getAttachment(c.env, attachmentId);
  if (!att) {
    return c.json({ success: false, error: "\u9644\u4EF6\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u6E05\u7406" }, 404);
  }
  const encodedFilename = encodeURIComponent(att.filename);
  return new Response(att.data, {
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    }
  });
});

// src/services/emailSender.ts
var EmailSenderService = class {
  /**
   * 发送邮件并写入日志
   */
  static async send(env, options) {
    const channel = await getSetting(env.DB, "send_channel", "resend");
    let success = false;
    let errorMsg;
    let externalId;
    try {
      if (channel === "resend") {
        const result = await this.sendViaResend(env, options);
        success = result.success;
        errorMsg = result.error;
        externalId = result.id;
      } else {
        const result = await this.sendViaCustomGateway(env, options);
        success = result.success;
        errorMsg = result.error;
      }
    } catch (err) {
      success = false;
      errorMsg = err instanceof Error ? err.message : String(err);
    }
    try {
      const logId = generateId();
      await env.DB.prepare(`
        INSERT INTO send_logs (id, user_id, from_address, to_addresses, subject, channel, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logId,
        options.userId,
        options.fromAddress,
        JSON.stringify(options.to),
        options.subject || "(\u65E0\u4E3B\u9898)",
        channel,
        success ? "success" : "failed",
        errorMsg || null,
        currentTimestamp()
      ).run();
    } catch (logErr) {
      console.error("Failed to write send log:", logErr);
    }
    return {
      success,
      error: errorMsg,
      messageId: externalId
    };
  }
  /**
   * 通过 Resend API 发送邮件 (推荐方案)
   */
  static async sendViaResend(env, options) {
    const apiKey = await getSetting(env.DB, "resend_api_key");
    if (!apiKey) {
      return {
        success: false,
        error: "\u672A\u914D\u7F6E Resend API Key\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u5728\u540E\u53F0\u8BBE\u7F6E"
      };
    }
    const fromDisplay = options.fromName ? `${options.fromName} <${options.fromAddress}>` : options.fromAddress;
    const payload = {
      from: fromDisplay,
      to: options.to,
      subject: options.subject
    };
    if (options.cc && options.cc.length > 0) payload.cc = options.cc;
    if (options.bcc && options.bcc.length > 0) payload.bcc = options.bcc;
    if (options.replyTo) payload.reply_to = options.replyTo;
    if (options.html) payload.html = options.html;
    if (options.text) payload.text = options.text;
    if (!options.html && !options.text) payload.text = " ";
    if (options.attachments && options.attachments.length > 0) {
      payload.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content
      }));
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const errMsg = data && typeof data === "object" && "message" in data ? String(data.message) : `Resend API HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }
    return { success: true, id: data.id ? String(data.id) : void 0 };
  }
  /**
   * 自定义/外部 HTTP 发信网关
   */
  static async sendViaCustomGateway(env, options) {
    const smtpHost = await getSetting(env.DB, "smtp_host");
    if (!smtpHost) {
      return {
        success: false,
        error: "SMTP \u4E3B\u673A\u672A\u914D\u7F6E\uFF0C\u8BF7\u5728\u540E\u53F0\u8BBE\u7F6E\u53D1\u4FE1\u901A\u9053"
      };
    }
    return {
      success: false,
      error: "SMTP \u7EAF\u76F4\u8FDE\u9700\u914D\u7F6E\u4E13\u6709\u53D1\u4FE1\u7AEF\u70B9\u6216\u63A8\u8350\u5207\u6362\u81F3 Resend API \u901A\u9053"
    };
  }
  /**
   * 测试发信渠道配置
   */
  static async testConnection(env, targetEmail) {
    const channel = await getSetting(env.DB, "send_channel", "resend");
    if (channel === "resend") {
      const apiKey = await getSetting(env.DB, "resend_api_key");
      if (!apiKey) {
        return { success: false, message: "\u8BF7\u5148\u586B\u5199 Resend API Key" };
      }
      const mailbox = await env.DB.prepare("SELECT address FROM mailboxes LIMIT 1").first();
      const fromAddr = mailbox?.address || "onboarding@resend.dev";
      const res = await this.sendViaResend(env, {
        userId: "admin_test",
        fromName: "Cloud Mail Test",
        fromAddress: fromAddr,
        to: [targetEmail],
        subject: "\u3010Cloud Mail\u3011\u6D4B\u8BD5\u90AE\u4EF6\uFF1A\u53D1\u4FE1\u901A\u9053\u8FDE\u901A\u6027\u6B63\u5E38",
        html: `
          <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">\u606D\u559C\uFF01Cloud Mail \u53D1\u4FE1\u901A\u9053\u6D4B\u8BD5\u6210\u529F</h2>
            <p>\u8FD9\u662F\u4E00\u5C01\u7531\u60A8\u7684 Cloud Mail \u57DF\u540D\u90AE\u7BB1\u7BA1\u7406\u7CFB\u7EDF\u53D1\u51FA\u7684\u6D4B\u8BD5\u90AE\u4EF6\u3002</p>
            <p><strong>\u5F53\u524D\u53D1\u4FE1\u6E20\u9053\uFF1A</strong> Resend API</p>
            <p><strong>\u53D1\u9001\u65F6\u95F4\uFF1A</strong> ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">Cloud Mail - \u57FA\u4E8E Cloudflare \u5168\u6808\u6784\u5EFA\u7684\u5F00\u6E90\u57DF\u540D\u90AE\u7BB1\u7CFB\u7EDF</p>
          </div>
        `
      });
      if (res.success) {
        return { success: true, message: "\u6D4B\u8BD5\u90AE\u4EF6\u5DF2\u6210\u529F\u53D1\u51FA\uFF0C\u8BF7\u68C0\u67E5\u6536\u4EF6\u7BB1\uFF08\u5305\u62EC\u5783\u573E\u7BB1\uFF09\uFF01" };
      } else {
        return { success: false, message: `\u53D1\u4FE1\u5931\u8D25: ${res.error}` };
      }
    }
    return { success: false, message: `\u6682\u4E0D\u652F\u6301\u8BE5\u53D1\u4FE1\u6E20\u9053\u6D4B\u8BD5: ${channel}` };
  }
};

// src/routes/send.ts
var sendRouter = new Hono3();
sendRouter.use("*", authMiddleware);
sendRouter.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const {
      mailboxId,
      fromAddress,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      text,
      html,
      attachments
    } = body;
    let mailbox = null;
    if (mailboxId) {
      mailbox = await c.env.DB.prepare("SELECT * FROM mailboxes WHERE id = ? AND user_id = ? AND is_active = 1").bind(mailboxId, user.id).first();
    } else if (fromAddress) {
      mailbox = await c.env.DB.prepare("SELECT * FROM mailboxes WHERE LOWER(address) = ? AND user_id = ? AND is_active = 1").bind(fromAddress.toLowerCase(), user.id).first();
    } else {
      mailbox = await c.env.DB.prepare("SELECT * FROM mailboxes WHERE user_id = ? AND is_active = 1 ORDER BY is_primary DESC LIMIT 1").bind(user.id).first();
    }
    if (!mailbox) {
      return c.json({ success: false, error: "\u672A\u627E\u5230\u5408\u6CD5\u7684\u53D1\u4FE1\u90AE\u7BB1\u5730\u5740" }, 400);
    }
    if (!to || !Array.isArray(to) || to.length === 0) {
      return c.json({ success: false, error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u6536\u4EF6\u4EBA" }, 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const addr of to) {
      if (!emailRegex.test(addr.trim())) {
        return c.json({ success: false, error: `\u65E0\u6548\u7684\u6536\u4EF6\u4EBA\u90AE\u7BB1\u683C\u5F0F: ${addr}` }, 400);
      }
    }
    const cleanTo = to.map((addr) => addr.trim());
    const cleanCc = Array.isArray(cc) ? cc.map((addr) => addr.trim()).filter((a) => emailRegex.test(a)) : [];
    const cleanBcc = Array.isArray(bcc) ? bcc.map((addr) => addr.trim()).filter((a) => emailRegex.test(a)) : [];
    const mailSubject = (subject || "").trim() || "(\u65E0\u4E3B\u9898)";
    const mailText = text || "";
    const mailHtml = html || (mailText ? `<pre style="font-family: inherit; white-space: pre-wrap;">${mailText}</pre>` : "");
    const sendResult = await EmailSenderService.send(c.env, {
      userId: user.id,
      fromName: mailbox.name || user.username,
      fromAddress: mailbox.address,
      to: cleanTo,
      cc: cleanCc.length > 0 ? cleanCc : void 0,
      bcc: cleanBcc.length > 0 ? cleanBcc : void 0,
      replyTo: replyTo || mailbox.address,
      subject: mailSubject,
      text: mailText,
      html: mailHtml,
      attachments: attachments && Array.isArray(attachments) ? attachments : void 0
    });
    if (!sendResult.success) {
      return c.json({ success: false, error: sendResult.error || "\u90AE\u4EF6\u6295\u9012\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u53D1\u4FE1\u901A\u9053\u8BBE\u7F6E" }, 502);
    }
    const emailId = generateId();
    const now = currentTimestamp();
    const snippet = (mailText || mailSubject).slice(0, 150).replace(/\s+/g, " ").trim();
    const toObjects = cleanTo.map((addr) => ({ name: "", address: addr }));
    const ccObjects = cleanCc.map((addr) => ({ name: "", address: addr }));
    const bccObjects = cleanBcc.map((addr) => ({ name: "", address: addr }));
    const rawSize = mailHtml.length + mailText.length;
    await c.env.DB.prepare(`
      INSERT INTO emails (
        id, mailbox_id, user_id, message_id, direction,
        from_name, from_address, to_addresses, cc_addresses, bcc_addresses,
        reply_to, subject, snippet, body_text, body_html, raw_size,
        is_read, is_starred, is_trash, is_spam, created_at
      ) VALUES (
        ?, ?, ?, ?, 'outbound',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        1, 0, 0, 0, ?
      )
    `).bind(
      emailId,
      mailbox.id,
      user.id,
      sendResult.messageId || null,
      mailbox.name || user.username,
      mailbox.address,
      JSON.stringify(toObjects),
      ccObjects.length > 0 ? JSON.stringify(ccObjects) : null,
      bccObjects.length > 0 ? JSON.stringify(bccObjects) : null,
      replyTo || null,
      mailSubject,
      snippet,
      mailText,
      mailHtml,
      rawSize,
      now
    ).run();
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.filename && att.content) {
          const binaryStr = atob(att.content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          await StorageService.saveAttachment(c.env, {
            emailId,
            filename: att.filename,
            contentType: att.contentType || "application/octet-stream",
            size: bytes.byteLength,
            data: bytes
          });
        }
      }
    }
    return c.json({
      success: true,
      message: "\u90AE\u4EF6\u53D1\u9001\u6210\u529F",
      data: {
        emailId,
        messageId: sendResult.messageId
      }
    });
  } catch (error) {
    console.error("Send email error:", error);
    return c.json({ success: false, error: "\u53D1\u4FE1\u670D\u52A1\u5F02\u5E38" }, 500);
  }
});

// src/routes/admin.ts
var adminRouter = new Hono3();
adminRouter.use("*", authMiddleware, adminMiddleware);
adminRouter.get("/overview", async (c) => {
  const usersCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
  const domainsCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM domains").first();
  const mailboxesCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM mailboxes").first();
  const emailsCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM emails").first();
  const startOfDay = Math.floor((/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0) / 1e3);
  const todayEmailsCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM emails WHERE created_at >= ?").bind(startOfDay).first();
  const storageUsed = await c.env.DB.prepare("SELECT SUM(used_bytes) as total FROM users").first();
  return c.json({
    success: true,
    data: {
      totalUsers: usersCount?.count || 0,
      totalDomains: domainsCount?.count || 0,
      totalMailboxes: mailboxesCount?.count || 0,
      totalEmails: emailsCount?.count || 0,
      todayEmails: todayEmailsCount?.count || 0,
      totalStorageBytes: storageUsed?.total || 0
    }
  });
});
adminRouter.get("/domains", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT d.*, 
      (SELECT COUNT(*) FROM mailboxes m WHERE m.domain_id = d.id) as mailbox_count
    FROM domains d
    ORDER BY d.is_default DESC, d.created_at ASC
  `).all();
  return c.json({ success: true, data: results });
});
adminRouter.post("/domains", async (c) => {
  const { domainName, description, isDefault } = await c.req.json();
  if (!domainName) {
    return c.json({ success: false, error: "\u57DF\u540D\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const cleanDomain = domainName.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain)) {
    return c.json({ success: false, error: "\u57DF\u540D\u683C\u5F0F\u4E0D\u6B63\u786E" }, 400);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM domains WHERE domain_name = ?").bind(cleanDomain).first();
  if (existing) {
    return c.json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 400);
  }
  const domainId = generateId();
  const now = currentTimestamp();
  if (isDefault) {
    await c.env.DB.prepare("UPDATE domains SET is_default = 0").run();
  }
  await c.env.DB.prepare(`
    INSERT INTO domains (id, domain_name, is_active, is_default, description, created_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `).bind(domainId, cleanDomain, isDefault ? 1 : 0, description || null, now).run();
  return c.json({
    success: true,
    data: { id: domainId, domain_name: cleanDomain }
  });
});
adminRouter.put("/domains/:id", async (c) => {
  const domainId = c.req.param("id");
  const { isActive, isDefault, description } = await c.req.json();
  if (isDefault) {
    await c.env.DB.prepare("UPDATE domains SET is_default = 0").run();
  }
  await c.env.DB.prepare(`
    UPDATE domains 
    SET is_active = COALESCE(?, is_active),
        is_default = COALESCE(?, is_default),
        description = COALESCE(?, description)
    WHERE id = ?
  `).bind(
    typeof isActive === "boolean" ? isActive ? 1 : 0 : null,
    typeof isDefault === "boolean" ? isDefault ? 1 : 0 : null,
    description !== void 0 ? description : null,
    domainId
  ).run();
  return c.json({ success: true, message: "\u57DF\u540D\u914D\u7F6E\u5DF2\u66F4\u65B0" });
});
adminRouter.delete("/domains/:id", async (c) => {
  const domainId = c.req.param("id");
  const mailboxCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM mailboxes WHERE domain_id = ?").bind(domainId).first();
  if (mailboxCount && mailboxCount.count > 0) {
    return c.json({ success: false, error: `\u8BE5\u57DF\u540D\u4E0B\u4ECD\u6709 ${mailboxCount.count} \u4E2A\u90AE\u7BB1\u522B\u540D\uFF0C\u65E0\u6CD5\u76F4\u63A5\u5220\u9664` }, 400);
  }
  await c.env.DB.prepare("DELETE FROM domains WHERE id = ?").bind(domainId).run();
  return c.json({ success: true, message: "\u57DF\u540D\u5DF2\u5220\u9664" });
});
adminRouter.get("/domains/:id/dns", async (c) => {
  const domainId = c.req.param("id");
  const domain = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ?").bind(domainId).first();
  if (!domain) {
    return c.json({ success: false, error: "\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  const d = domain.domain_name;
  const records = [
    {
      type: "MX",
      name: "@",
      value: "isaac.mx.cloudflare.net",
      priority: 13,
      purpose: "Cloudflare Email Routing \u6536\u4FE1\u8DEF\u7531\u89E3\u6790 1"
    },
    {
      type: "MX",
      name: "@",
      value: "linda.mx.cloudflare.net",
      priority: 56,
      purpose: "Cloudflare Email Routing \u6536\u4FE1\u8DEF\u7531\u89E3\u6790 2"
    },
    {
      type: "MX",
      name: "@",
      value: "amir.mx.cloudflare.net",
      priority: 91,
      purpose: "Cloudflare Email Routing \u6536\u4FE1\u8DEF\u7531\u89E3\u6790 3"
    },
    {
      type: "TXT",
      name: "@",
      value: "v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all",
      purpose: "SPF \u53D1\u4FE1\u9632\u4F2A\u8BA4\u8BC1 (\u6388\u6743 Cloudflare & Resend \u53D1\u4FE1)"
    },
    {
      type: "TXT",
      name: "_dmarc",
      value: `v=DMARC1; p=none; rua=mailto:dmarc-reports@${d}`,
      purpose: "DMARC \u90AE\u4EF6\u7B56\u7565\u4E0E\u9632\u4F2A\u9020\u6295\u9012\u4FDD\u62A4"
    },
    {
      type: "TXT / CNAME",
      name: `resend._domainkey.${d}`,
      value: "\u53EF\u5728 Resend \u63A7\u5236\u53F0\u6DFB\u52A0\u57DF\u540D\u540E\u83B7\u53D6\u5BF9\u5E94\u7684 DKIM \u5BC6\u94A5\u8BB0\u5F55",
      purpose: "DKIM \u6570\u5B57\u7B7E\u540D\u9632\u7BE1\u6539 (\u9AD8\u9001\u8FBE\u7387\u5FC5\u9700)"
    }
  ];
  return c.json({
    success: true,
    data: {
      domain: d,
      records
    }
  });
});
adminRouter.get("/users", async (c) => {
  const search = c.req.query("search")?.trim();
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));
  const offset = (page - 1) * limit;
  let whereSql = "";
  const params = [];
  if (search) {
    whereSql = "WHERE u.username LIKE ?";
    params.push(`%${search}%`);
  }
  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM users u ${whereSql}`).bind(...params).first();
  const total = countResult?.count || 0;
  const { results } = await c.env.DB.prepare(`
    SELECT 
      u.id, u.username, u.role, u.is_active, u.quota_bytes, u.used_bytes, u.created_at, u.updated_at,
      (SELECT address FROM mailboxes WHERE user_id = u.id AND is_primary = 1 LIMIT 1) as primary_email,
      (SELECT COUNT(*) FROM mailboxes WHERE user_id = u.id) as mailbox_count,
      (SELECT COUNT(*) FROM emails WHERE user_id = u.id) as email_count
    FROM users u
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();
  return c.json({
    success: true,
    data: {
      items: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});
adminRouter.post("/users", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, domainId, mailboxPrefix, role, quotaMb } = body;
    if (!username || !password) {
      return c.json({ success: false, error: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    if (username.length < 3 || username.length > 30) {
      return c.json({ success: false, error: "\u7528\u6237\u540D\u957F\u5EA6\u9700\u5728 3 \u5230 30 \u4E2A\u5B57\u7B26\u4E4B\u95F4" }, 400);
    }
    if (password.length < 6) {
      return c.json({ success: false, error: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11\u9700 6 \u4E2A\u5B57\u7B26" }, 400);
    }
    const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username.toLowerCase()).first();
    if (existingUser) {
      return c.json({ success: false, error: "\u8BE5\u7528\u6237\u540D\u5DF2\u5B58\u5728" }, 400);
    }
    let targetDomain = null;
    if (domainId) {
      targetDomain = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ? AND is_active = 1").bind(domainId).first();
    } else {
      targetDomain = await c.env.DB.prepare("SELECT * FROM domains WHERE is_active = 1 ORDER BY is_default DESC, created_at ASC LIMIT 1").first();
    }
    const prefix = (mailboxPrefix || username).trim().toLowerCase();
    if (!/^[a-zA-Z0-9._-]+$/.test(prefix)) {
      return c.json({ success: false, error: "\u90AE\u7BB1\u524D\u7F00\u53EA\u5141\u8BB8\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u70B9\u3001\u4E0B\u5212\u7EBF\u53CA\u51CF\u53F7" }, 400);
    }
    const domainName = targetDomain ? targetDomain.domain_name : "localhost";
    const emailAddress = `${prefix}@${domainName}`.toLowerCase();
    const existingMailbox = await c.env.DB.prepare("SELECT id FROM mailboxes WHERE LOWER(address) = ?").bind(emailAddress).first();
    if (existingMailbox) {
      return c.json({ success: false, error: `\u90AE\u7BB1\u5730\u5740 ${emailAddress} \u5DF2\u88AB\u5360\u7528` }, 400);
    }
    const userId = generateId();
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = currentTimestamp();
    const mb = parseInt(quotaMb || "500", 10);
    const quotaBytes = (isNaN(mb) ? 500 : mb) * 1024 * 1024;
    const userRole = role === "admin" ? "admin" : "user";
    await c.env.DB.prepare(`
      INSERT INTO users (id, username, password_hash, salt, role, is_active, quota_bytes, used_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
    `).bind(userId, username.toLowerCase(), passwordHash, salt, userRole, quotaBytes, now, now).run();
    const mailboxId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO mailboxes (id, user_id, address, domain_id, name, is_primary, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    `).bind(mailboxId, userId, emailAddress, targetDomain ? targetDomain.id : null, username, now).run();
    return c.json({
      success: true,
      message: "\u7528\u6237\u521B\u5EFA\u6210\u529F",
      data: {
        id: userId,
        username,
        role: userRole,
        primaryEmail: emailAddress
      }
    });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : "\u521B\u5EFA\u7528\u6237\u5931\u8D25" }, 500);
  }
});
adminRouter.patch("/users/:id/status", async (c) => {
  const admin = c.get("user");
  const targetId = c.req.param("id");
  const { isActive } = await c.req.json();
  if (admin.id === targetId) {
    return c.json({ success: false, error: "\u4E0D\u80FD\u7981\u7528\u81EA\u5DF1\u7684\u8D26\u53F7" }, 400);
  }
  await c.env.DB.prepare("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?").bind(isActive ? 1 : 0, currentTimestamp(), targetId).run();
  return c.json({ success: true, message: isActive ? "\u7528\u6237\u5DF2\u542F\u7528" : "\u7528\u6237\u5DF2\u7981\u7528" });
});
adminRouter.patch("/users/:id/role", async (c) => {
  const admin = c.get("user");
  const targetId = c.req.param("id");
  const { role } = await c.req.json();
  if (admin.id === targetId) {
    return c.json({ success: false, error: "\u4E0D\u80FD\u4FEE\u6539\u81EA\u5DF1\u7684\u7BA1\u7406\u5458\u6743\u9650" }, 400);
  }
  if (role !== "admin" && role !== "user") {
    return c.json({ success: false, error: "\u89D2\u8272\u53C2\u6570\u9519\u8BEF" }, 400);
  }
  await c.env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(role, currentTimestamp(), targetId).run();
  return c.json({ success: true, message: "\u89D2\u8272\u5DF2\u66F4\u65B0" });
});
adminRouter.put("/users/:id/quota", async (c) => {
  const targetId = c.req.param("id");
  const { quotaMb } = await c.req.json();
  const mb = parseInt(quotaMb, 10);
  if (isNaN(mb) || mb < 10) {
    return c.json({ success: false, error: "\u914D\u989D\u5927\u5C0F\u9700\u81F3\u5C11\u4E3A 10MB" }, 400);
  }
  const quotaBytes = mb * 1024 * 1024;
  await c.env.DB.prepare("UPDATE users SET quota_bytes = ?, updated_at = ? WHERE id = ?").bind(quotaBytes, currentTimestamp(), targetId).run();
  return c.json({ success: true, message: "\u914D\u989D\u5DF2\u8C03\u6574" });
});
adminRouter.post("/users/:id/reset-password", async (c) => {
  const targetId = c.req.param("id");
  const { newPassword } = await c.req.json();
  if (!newPassword || newPassword.length < 6) {
    return c.json({ success: false, error: "\u65B0\u5BC6\u7801\u81F3\u5C11\u9700 6 \u4E2A\u5B57\u7B26" }, 400);
  }
  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  await c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?").bind(newHash, newSalt, currentTimestamp(), targetId).run();
  return c.json({ success: true, message: "\u5BC6\u7801\u5DF2\u91CD\u7F6E" });
});
adminRouter.delete("/users/:id", async (c) => {
  const admin = c.get("user");
  const targetId = c.req.param("id");
  if (admin.id === targetId) {
    return c.json({ success: false, error: "\u4E0D\u80FD\u5220\u9664\u81EA\u5DF1\u7684\u8D26\u53F7" }, 400);
  }
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(targetId).run();
  return c.json({ success: true, message: "\u7528\u6237\u5DF2\u5F7B\u5E95\u5220\u9664" });
});
adminRouter.get("/settings", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT key, value, description FROM settings").all();
  const settings = {};
  for (const item of results) {
    settings[item.key] = item.value;
  }
  return c.json({ success: true, data: settings });
});
adminRouter.put("/settings", async (c) => {
  const body = await c.req.json();
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      await setSetting(c.env.DB, key, String(val));
    }
  }
  return c.json({ success: true, message: "\u7CFB\u7EDF\u8BBE\u7F6E\u5DF2\u4FDD\u5B58" });
});
adminRouter.post("/test-send", async (c) => {
  const { targetEmail } = await c.req.json();
  if (!targetEmail) {
    return c.json({ success: false, error: "\u76EE\u6807\u6D4B\u8BD5\u90AE\u7BB1\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const result = await EmailSenderService.testConnection(c.env, targetEmail);
  return c.json(result);
});
adminRouter.get("/logs", async (c) => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50", 10)));
  const { results } = await c.env.DB.prepare(`
    SELECT l.*, u.username 
    FROM send_logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `).bind(limit).all();
  return c.json({ success: true, data: results });
});

// src/index.ts
var app = new Hono3();
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length", "Content-Disposition"],
  maxAge: 86400
}));
app.get("/api/health", (c) => {
  return c.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.route("/api/auth", authRouter);
app.route("/api/mailboxes", mailboxRouter);
app.route("/api/emails", emailRouter);
app.route("/api/send", sendRouter);
app.route("/api/admin", adminRouter);
app.onError((err, c) => {
  console.error("[App Error]", err);
  return c.json({
    success: false,
    error: err.message || "\u670D\u52A1\u5668\u5185\u90E8\u5F02\u5E38"
  }, 500);
});
app.all("*", async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Cloud Mail API is running. Build frontend into ./frontend/dist for UI.", 200);
});
var index_default = {
  fetch: app.fetch,
  email: handleEmail
};
export {
  index_default as default
};
