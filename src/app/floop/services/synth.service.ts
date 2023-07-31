import { Injectable } from '@angular/core';

import * as Tone from 'tone/build/esm';


@Injectable( {
	providedIn: 'any',
} )
export class SynthService{

	public synth?:Tone.Synth;

	constructor(){
		this.synth = new Tone.Synth().toDestination();
	}

	public test(){
		this.synth?.triggerAttackRelease( 'C4', '8n' );
	}

	public static bpmToMS( bpm:number ):number{
		return 60000 / bpm;
	}

}
