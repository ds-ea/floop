import { EventEmitter, Injectable, Output } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { FloopSettings } from '../types/floop.types';


@Injectable( {
	providedIn: 'root',
} )
export class FloopDeviceService{


	public get settings():FloopSettings{
		return this._settings;
	}

	public set settings( value:FloopSettings ){
		this._settings = value;
		this.settingsChanged.emit( value );
		this.storeSettings(value);
	}

	private _settings:FloopSettings = {
		quickBoot: false,
		deviceVolume: 100
	};

	@Output('settings') settingsChanged = new EventEmitter<FloopSettings>();

	constructor(){

	}


	public async restoreSettings(){
		try{
			const storedSettingsRaw = await Preferences.get( { key: 'floop.settings' } );
			const storedSettings:FloopSettings | undefined = storedSettingsRaw.value ? JSON.parse( storedSettingsRaw.value ) : undefined;

			if( storedSettings && typeof storedSettings === 'object' )
				Object.assign( this._settings, storedSettings );

			return storedSettings;

		}catch( error ){
			console.error( 'error restoring settings', error );
			return Promise.reject( 'error restoring settings' );
		}
	}

	public storeSettings( settings:FloopSettings ){
		if( !settings || typeof settings !== 'object')
			return Promise.reject('invalid settings');

		return Preferences.set( { key: 'floop.settings', value: JSON.stringify( settings ) } );
	}

}
