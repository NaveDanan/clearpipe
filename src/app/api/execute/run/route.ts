import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Expand tilde to user home directory (cross-platform)
 */
function expandTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    return filePath.replace(/^~/, os.homedir());
  }
  return filePath;
}

/**
 * Get the Python executable path for a given venv directory
 * Handles cross-platform differences (Linux/macOS vs Windows)
 */
function getVenvPythonPath(venvPath: string): string {
  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    return path.join(venvPath, 'Scripts', 'python.exe');
  }
  // Try python3 first, fall back to python
  const python3Path = path.join(venvPath, 'bin', 'python3');
  if (fsSync.existsSync(python3Path)) {
    return python3Path;
  }
  return path.join(venvPath, 'bin', 'python');
}

/**
 * Check if a directory is a valid Python virtual environment
 */
function isValidVenv(venvPath: string): boolean {
  const expandedPath = expandTilde(venvPath);
  if (!fsSync.existsSync(expandedPath)) {
    return false;
  }
  
  const pythonPath = getVenvPythonPath(expandedPath);
  if (!fsSync.existsSync(pythonPath)) {
    // Try alternative python path
    const altPythonPath = path.join(expandedPath, 'bin', 'python');
    if (!fsSync.existsSync(altPythonPath)) {
      return false;
    }
  }
  
  // Check for pyvenv.cfg or activate script as additional validation
  const pyvenvCfg = path.join(expandedPath, 'pyvenv.cfg');
  const activateScript = os.platform() === 'win32'
    ? path.join(expandedPath, 'Scripts', 'activate.bat')
    : path.join(expandedPath, 'bin', 'activate');
  
  return fsSync.existsSync(pyvenvCfg) || fsSync.existsSync(activateScript);
}

/**
 * Auto-detect venv in script directory
 */
function autoDetectVenv(scriptPath: string): string | null {
  const expandedScriptPath = expandTilde(scriptPath);
  const scriptDir = path.dirname(expandedScriptPath);
  
  // Common venv folder names to check
  const venvNames = ['.venv', 'venv', '.env', 'env'];
  
  for (const venvName of venvNames) {
    const potentialVenvPath = path.join(scriptDir, venvName);
    if (isValidVenv(potentialVenvPath)) {
      return potentialVenvPath;
    }
  }
  
  return null;
}

/**
 * Determine the Python command to use based on venv configuration
 */
function getPythonCommand(step: ExecuteStep): { pythonPath: string; venvUsed: boolean; venvPath?: string } {
  // If venv mode is 'none', use system Python
  if (step.venvMode === 'none') {
    return { pythonPath: 'python3', venvUsed: false };
  }
  
  // If venv mode is 'custom' and a path is provided, use that
  if (step.venvMode === 'custom' && step.venvPath) {
    const expandedPath = expandTilde(step.venvPath);
    if (isValidVenv(expandedPath)) {
      const pythonPath = getVenvPythonPath(expandedPath);
      return { pythonPath, venvUsed: true, venvPath: expandedPath };
    }
    // Custom venv path invalid, fall back to system Python
    return { pythonPath: 'python3', venvUsed: false };
  }
  
  // Auto-detect mode (default)
  if (step.scriptPath) {
    const detectedVenvPath = autoDetectVenv(step.scriptPath);
    if (detectedVenvPath) {
      const pythonPath = getVenvPythonPath(detectedVenvPath);
      return { pythonPath, venvUsed: true, venvPath: detectedVenvPath };
    }
  }
  
  // If already have a venvPath from previous detection, use it
  if (step.venvPath) {
    const expandedPath = expandTilde(step.venvPath);
    if (isValidVenv(expandedPath)) {
      const pythonPath = getVenvPythonPath(expandedPath);
      return { pythonPath, venvUsed: true, venvPath: expandedPath };
    }
  }
  
  // Fall back to system Python
  return { pythonPath: 'python3', venvUsed: false };
}

interface ExecuteStep {
  id: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
  enabled: boolean;
  scriptSource?: 'local' | 'inline';
  scriptPath?: string;
  inlineScript?: string;
  useDataSourceVariable?: boolean; // Whether to use data source variable replacement
  dataSourceVariable?: string;
  useOutputVariables?: boolean; // Whether to use output variable replacement
  outputVariables?: string[]; // Support multiple output variables
  // Virtual environment configuration
  venvPath?: string;
  venvMode?: 'auto' | 'custom' | 'none';
}

interface RunExecuteRequest {
  step: ExecuteStep;
  inputPath: string; // Path from the dataset node
}

interface ExecuteResult {
  success: boolean;
  outputPaths?: string[]; // Multiple output paths
  outputPath?: string; // Primary output path (first one) for backward compatibility
  stdout?: string;
  stderr?: string;
  error?: string;
  stepId: string;
  stepName: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ExecuteResult>> {
  try {
    const body: RunExecuteRequest = await request.json();
    const { step, inputPath } = body;

    if (!step) {
      return NextResponse.json({
        success: false,
        error: 'No step provided',
        stepId: '',
        stepName: '',
      });
    }

    // Check if input path is required (only when useDataSourceVariable is true or undefined)
    const requiresInputPath = step.useDataSourceVariable !== false;
    
    if (!inputPath && requiresInputPath) {
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
    const useDataSource = step.useDataSourceVariable !== false;
    const useOutputVars = step.useOutputVariables !== false;
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
    // 1. Optionally sets up the data source variable
    // 2. Runs the original script
    // 3. Optionally captures multiple output paths
    const tempDir = os.tmpdir();
    const wrapperScriptPath = path.join(tempDir, `wrapper_${step.id}_${Date.now()}.py`);
    
    // Escape paths for Python string (use empty string if no input path)
    const escapedInputPath = inputPath ? inputPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
    
    // Conditionally set up data source variable
    const dataSourceSetup = useDataSource && inputPath
      ? `# Set the data source variable\n${dataSourceVariable} = '${escapedInputPath}'`
      : '# Data source variable disabled';
    
    // Conditionally initialize output variables
    const outputVarInit = useOutputVars
      ? outputVariables.map(v => `${v} = None`).join('\n')
      : '# Output variables disabled';
    
    // Conditionally create the output printing logic
    const outputPrintLogic = useOutputVars
      ? outputVariables.map(v => `
if ${v} is not None:
    print(f"__OUTPUT__${v}__:{${v}}")
${escapedInputPath ? `else:\n    print(f"__OUTPUT__${v}__:${escapedInputPath}")` : ''}
`).join('\n')
      : '# Output variable printing disabled';
    
    // Create wrapper script
    const wrapperScript = `
import sys
import os

${dataSourceSetup}

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
      // Determine the Python command based on venv configuration
      const { pythonPath, venvUsed, venvPath } = getPythonCommand(step);
      
      // Log which Python is being used (for debugging)
      console.log(`[Execute] Using Python: ${pythonPath} (venv: ${venvUsed ? venvPath : 'none'})`);
      
      // Execute the Python script with the appropriate Python interpreter
      const { stdout, stderr } = await execAsync(`"${pythonPath}" "${wrapperScriptPath}"`, {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        cwd: path.dirname(step.scriptPath || wrapperScriptPath),
      });

      // Parse all output paths from stdout (only if output variables are enabled)
      const outputPaths: string[] = [];
      if (useOutputVars) {
        for (const varName of outputVariables) {
          const regex = new RegExp(`__OUTPUT__${varName}__:(.+)`);
          const match = stdout.match(regex);
          if (match) {
            outputPaths.push(match[1].trim());
          } else if (inputPath) {
            outputPaths.push(inputPath); // Fallback to input path
          }
        }
      }

      // Clean stdout by removing all output markers
      let cleanStdout = stdout;
      if (useOutputVars) {
        for (const varName of outputVariables) {
          cleanStdout = cleanStdout.replace(new RegExp(`__OUTPUT__${varName}__:.+\\n?`, 'g'), '');
        }
      }

      // Clean up wrapper script
      try {
        await fs.unlink(wrapperScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      return NextResponse.json({
        success: true,
        outputPath: outputPaths[0] || inputPath || undefined, // Primary output for backward compatibility
        outputPaths: outputPaths.length > 0 ? outputPaths : (inputPath ? [inputPath] : []),
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
