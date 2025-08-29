import { b as Response, P as ParsedJSON } from '../index-s2Ddf-Na.mjs';
import Gateway from './gateway.mjs';
import { Method, HTTPGatewayConfiguration, HTTPRequestParams } from './types.mjs';
import '../types.mjs';

type Chunk = any;
declare class HTTP extends Gateway {
    private canceled;
    get(): void;
    head(): void;
    post(): void;
    put(): void;
    patch(): void;
    delete(): void;
    performRequest(method: Method): void;
    onResponse(httpResponse: undefined, httpOptions: Partial<HTTPGatewayConfiguration>, requestParams: HTTPRequestParams): void;
    onError(e: Error): void;
    createResponse(httpResponse: undefined, rawData: Chunk): Response<ParsedJSON>;
}

export { HTTP, HTTP as default };
