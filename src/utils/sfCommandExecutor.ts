import { exec } from 'child_process';

/**
 * Execute Salesforce CLI commands with proper argument handling
 */
export function executeSfCommand(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		console.log('Executing sf command with args:', args);
		
		// Build the command string with proper quoting
		// Quote arguments that contain spaces or special characters
		const quotedArgs = args.map(arg => {
			// If the argument contains spaces, quotes, or special chars, wrap it in quotes
			if (arg.includes(' ') || arg.includes("'") || arg.includes('"')) {
				// Escape any existing double quotes and wrap in double quotes
				return `"${arg.replace(/"/g, '\\"')}"`;
			}
			return arg;
		});
		
		const commandString = `sf ${quotedArgs.join(' ')}`;
		console.log('Full command:', commandString);
		
		// Use exec instead of spawn for better shell compatibility
		exec(commandString, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				const errorMsg = stderr || stdout || error.message;
				console.error('Command failed:', errorMsg);
				console.error('Command was:', commandString);
				reject(new Error(errorMsg));
			} else {
				resolve(stdout);
			}
		});
	});
}
