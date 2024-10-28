import { setResult, TaskResult } from "azure-pipelines-task-lib/task"
import { error } from "azure-pipelines-task-lib/task"

async function run() {
    try {
        
        // TODO: Install sbom-tool
        // TODO: Run sbom-tool

        setResult(TaskResult.Succeeded, 'Success');
    }
    catch (e: any) {
        error(`Unhandled exception: ${e}`);
        setResult(TaskResult.Failed, e?.message);
    }
}

run();
