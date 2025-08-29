// src/method-descriptor.ts
var MethodDescriptor = class {
  allowResourceHostOverride;
  parameterEncoder;
  authAttr;
  binary;
  bodyAttr;
  headers;
  headersAttr;
  host;
  hostAttr;
  method;
  middleware;
  params;
  path;
  pathAttr;
  queryParamAlias;
  timeoutAttr;
  constructor(params) {
    this.allowResourceHostOverride = params.allowResourceHostOverride || false;
    this.parameterEncoder = params.parameterEncoder || encodeURIComponent;
    this.binary = params.binary || false;
    this.headers = params.headers;
    this.host = params.host;
    this.method = params.method || "get";
    this.params = params.params;
    this.path = params.path;
    this.queryParamAlias = params.queryParamAlias || {};
    this.authAttr = params.authAttr || "auth";
    this.bodyAttr = params.bodyAttr || "body";
    this.headersAttr = params.headersAttr || "headers";
    this.hostAttr = params.hostAttr || "host";
    this.pathAttr = params.pathAttr || "path";
    this.timeoutAttr = params.timeoutAttr || "timeout";
    const resourceMiddleware = params.middleware || params.middlewares || [];
    this.middleware = resourceMiddleware;
  }
};
var method_descriptor_default = MethodDescriptor;
export {
  MethodDescriptor,
  method_descriptor_default as default
};
//# sourceMappingURL=method-descriptor.mjs.map