import { Component, OnInit } from '@angular/core';


@Component( {
	selector: 'settings-screen',
	styles:[`
		:host {
			display: flex;
			flex-direction: column;
			overflow: auto;
		}
	`],
	template: `
		SETTINGS!
	`,
} )

export class SettingsScreenComponent implements OnInit{
	constructor(){ }

	ngOnInit(){ }
}
