import { Component, OnInit } from '@angular/core';


@Component( {
	selector: 'instrument-screen',
	styles:[`
		:host {
			display: flex;
			flex-direction: column;
			overflow: auto;
		}
	`],
	template: `
		instruments
	`,
} )

export class InstrumentScreenComponent implements OnInit{
	constructor(){ }

	ngOnInit(){ }
}
