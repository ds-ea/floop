import { CapacitorConfig } from '@capacitor/cli';


const config:CapacitorConfig = {
	appId: 'net.dsea.floop',
	appName: 'floop',
	webDir: 'www',
	server: {
		androidScheme: 'https',
	},
	ios: {
		loggingBehavior: 'none',
	},
};

export default config;
