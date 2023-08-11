import { EventEmitter, Injectable, Output } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { FloopMemory, FloopSettings } from '../types/floop.types';


@Injectable( {
	providedIn: 'root',
} )
export class FloopDeviceService{

	public get memory():FloopMemory{
		return this._memory;
	}

	public set memory( value:FloopMemory ){
		this._memory = value;
		this.storeMemory( value );
	}
	private _memory:FloopMemory = {};


	public get settings():FloopSettings{
		return this._settings;
	}

	public set settings( value:FloopSettings ){
		this._settings = value;
		this.settingsChanged.emit( value );
		this.storeSettings( value );
	}

	private _settings:FloopSettings = {
		quickBoot: false,
		deviceVolume: 100,
	};

	@Output( 'settings' ) settingsChanged = new EventEmitter<FloopSettings>();

	constructor(){

	}


	public async restoreSettings(){
		try{
			const storedMemoryRaw = await Preferences.get( { key: 'floop.memory' } );
			const storedMemory:FloopMemory | undefined = storedMemoryRaw.value ? JSON.parse( storedMemoryRaw.value ) : undefined;
			if( storedMemory && typeof storedMemory === 'object' )
				Object.assign( this._memory, storedMemory );


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
		if( !settings || typeof settings !== 'object' )
			return Promise.reject( 'invalid settings' );

		return Preferences.set( { key: 'floop.settings', value: JSON.stringify( settings ) } );
	}

	public updateMemory( data:Partial<FloopMemory> ){
		this.memory = {...this.memory, ...data};
		return this.storeMemory( this.memory );
	}

	public storeMemory( memory:FloopMemory ){
		if( !memory || typeof memory !== 'object' )
			return Promise.reject( 'invalid memory' );

		return Preferences.set( { key: 'floop.memory', value: JSON.stringify( memory ) } );
	}

}
