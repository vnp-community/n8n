import { type ExecutionError, type INode, type IRun, type WorkflowExecuteMode } from 'n8n-workflow';
export declare class ExecutionDataService {
    generateFailedExecutionFromError(mode: WorkflowExecuteMode, error: ExecutionError, node: INode | undefined, startTime?: number): IRun;
}
