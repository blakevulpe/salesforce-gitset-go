import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Read custom settings from the YAML file
 */
export function readCustomSettingsYaml(yamlFilePath: string): string[] {
	if (!fs.existsSync(yamlFilePath)) {
		return [];
	}

	try {
		const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
		const yamlContent = yaml.load(fileContent) as any;
		
		if (yamlContent && yamlContent.CustomSettingsDataKeys && Array.isArray(yamlContent.CustomSettingsDataKeys)) {
			return yamlContent.CustomSettingsDataKeys;
		}
		return [];
	} catch (error) {
		console.error('Error reading YAML file:', error);
		return [];
	}
}

/**
 * Write custom settings to the YAML file
 */
export function writeCustomSettingsYaml(yamlFilePath: string, settings: string[]): void {
	// Create the parent directory if it doesn't exist
	const yamlDir = path.dirname(yamlFilePath);
	if (!fs.existsSync(yamlDir)) {
		fs.mkdirSync(yamlDir, { recursive: true });
	}

	const yamlContent = {
		CustomSettingsDataKeys: settings
	};

	const updatedYaml = yaml.dump(yamlContent);
	fs.writeFileSync(yamlFilePath, updatedYaml, 'utf8');
}

/**
 * Add settings to the YAML file (without duplicates)
 */
export function addSettingsToYaml(yamlFilePath: string, newSettings: string[]): { added: string[], existing: string[] } {
	const existingSettings = readCustomSettingsYaml(yamlFilePath);
	const added: string[] = [];
	const existing: string[] = [];

	for (const setting of newSettings) {
		if (!existingSettings.includes(setting)) {
			existingSettings.push(setting);
			added.push(setting);
		} else {
			existing.push(setting);
		}
	}

	if (added.length > 0) {
		writeCustomSettingsYaml(yamlFilePath, existingSettings);
	}

	return { added, existing };
}

/**
 * Update the YAML file with a new list of settings (replaces existing)
 */
export function updateSettingsInYaml(
	yamlFilePath: string,
	newSettings: string[]
): { added: string[], removed: string[] } {
	const previousSettings = readCustomSettingsYaml(yamlFilePath);
	
	const added = newSettings.filter(s => !previousSettings.includes(s));
	const removed = previousSettings.filter(s => !newSettings.includes(s));

	writeCustomSettingsYaml(yamlFilePath, newSettings);

	return { added, removed };
}

/**
 * Ensure a directory exists for a custom setting
 */
export function ensureCustomSettingDirectory(workspaceRoot: string, settingName: string): string {
	const settingDir = path.join(workspaceRoot, 'force-app', 'main', 'default', 'custom-settings', settingName);
	
	if (!fs.existsSync(settingDir)) {
		fs.mkdirSync(settingDir, { recursive: true });
	}
	
	return settingDir;
}

/**
 * Get the path to the custom-settings.yaml file
 */
export function getYamlFilePath(workspaceRoot: string): string {
	return path.join(workspaceRoot, 'force-app', 'main', 'default', '.custom-settings', 'custom-settings.yaml');
}
