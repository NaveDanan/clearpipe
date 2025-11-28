import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface PreprocessingStep {
  id: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
  enabled: boolean;
  scriptSource?: 'local' | 'inline';
  scriptPath?: string;
  inlineScript?: string;
  dataSourceVariable?: string;
  outputVariables?: string[]; // Support multiple output variables
}

interface RunPreprocessingRequest {
  step: PreprocessingStep;
  inputPath: string; // Path from the dataset node
}

interface PreprocessingResult {
  success: boolean;
  outputPaths?: string[]; // Multiple output paths
  outputPath?: string; // Primary output path (first one) for backward compatibility
  stdout?: string;
  stderr?: string;
  error?: string;
  stepId: string;
  stepName: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PreprocessingResult>> {
  try {
    const body: RunPreprocessingRequest = await request.json();
    const { step, inputPath } = body;

    if (!step) {
      return NextResponse.json({
        success: false,
        error: 'No step provided',
        stepId: '',
        stepName: '',
      });
    }

    if (!inputPath) {
      return NextResponse.json({
        success: false,
        error: 'No input path provided',
        stepId: step.id,
        stepName: step.name,
      });
    }

    if (!step.enabled) {
      return NextResponse.json({
        success: true,
        outputPath: inputPath,
        outputPaths: [inputPath],
        stepId: step.id,
        stepName: step.name,
      });
    }

    const dataSourceVariable = step.dataSourceVariable || 'DATA_SOURCE';
    const outputVariables = step.outputVariables && step.outputVariables.length > 0 
      ? step.outputVariables 
      : ['OUTPUT_PATH'];

    let scriptContent: string;
    let scriptPath: string;

    if (step.scriptSource === 'inline' && step.inlineScript) {
      // For inline scripts, create a temporary file
      const tempDir = os.tmpdir();
      scriptPath = path.join(tempDir, `preprocess_${step.id}_${Date.now()}.py`);
      scriptContent = step.inlineScript;
    } else if (step.scriptSource === 'local' || !step.scriptSource) {
      // For local file scripts
      if (!step.scriptPath) {
        return NextResponse.json({
          success: false,
          error: 'No script path provided for local file source',
          stepId: step.id,
          stepName: step.name,
        });
      }

      scriptPath = step.scriptPath;

      // Check if the script file exists
      try {
        await fs.access(scriptPath);
        scriptContent = await fs.readFile(scriptPath, 'utf-8');
      } catch {
        return NextResponse.json({
          success: false,
          error: `Script file not found: ${scriptPath}`,
          stepId: step.id,
          stepName: step.name,
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid script source configuration',
        stepId: step.id,
        stepName: step.name,
      });
    }

    // Create a wrapper script that:
    // 1. Sets up the data source variable
    // 2. Runs the original script
    // 3. Captures multiple output paths
    const tempDir = os.tmpdir();
    const wrapperScriptPath = path.join(tempDir, `wrapper_${step.id}_${Date.now()}.py`);
    
    // Escape paths for Python string
    const escapedInputPath = inputPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    // Initialize all output variables to None
    const outputVarInit = outputVariables.map(v => `${v} = None`).join('\n');
    
    // Create the output printing logic for all variables
    const outputPrintLogic = outputVariables.map(v => `
if ${v} is not None:
    print(f"__OUTPUT__${v}__:{${v}}")
else:
    print(f"__OUTPUT__${v}__:${escapedInputPath}")
`).join('\n');
    
    // Create wrapper script that sets the variable and captures outputs
    const wrapperScript = `
import sys
import os

# Set the data source variable
${dataSourceVariable} = '${escapedInputPath}'

# Initialize output variables
${outputVarInit}

# Store original script in a string and exec it
_original_script = '''${scriptContent.replace(/'/g, "\\'")}'''

# Execute the original script in the current namespace
exec(_original_script)

# Print all output paths at the end
${outputPrintLogic}
`;

    await fs.writeFile(wrapperScriptPath, wrapperScript, 'utf-8');

    try {
      // Execute the Python script
      const { stdout, stderr } = await execAsync(`python3 "${wrapperScriptPath}"`, {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        cwd: path.dirname(step.scriptPath || wrapperScriptPath),
      });

      // Parse all output paths from stdout
      const outputPaths: string[] = [];
      for (const varName of outputVariables) {
        const regex = new RegExp(`__OUTPUT__${varName}__:(.+)`);
        const match = stdout.match(regex);
        if (match) {
          outputPaths.push(match[1].trim());
        } else {
          outputPaths.push(inputPath); // Fallback to input path
        }
      }

      // Clean stdout by removing all output markers
      let cleanStdout = stdout;
      for (const varName of outputVariables) {
        cleanStdout = cleanStdout.replace(new RegExp(`__OUTPUT__${varName}__:.+\\n?`, 'g'), '');
      }

      // Clean up wrapper script
      try {
        await fs.unlink(wrapperScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      return NextResponse.json({
        success: true,
        outputPath: outputPaths[0] || inputPath, // Primary output for backward compatibility
        outputPaths,
        stdout: cleanStdout.trim(),
        stderr: stderr.trim(),
        stepId: step.id,
        stepName: step.name,
      });
    } catch (execError: any) {
      // Clean up wrapper script on error
      try {
        await fs.unlink(wrapperScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      return NextResponse.json({
        success: false,
        error: execError.message || 'Script execution failed',
        stderr: execError.stderr || '',
        stdout: execError.stdout || '',
        stepId: step.id,
        stepName: step.name,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      stepId: '',
      stepName: '',
    });
  }
}
