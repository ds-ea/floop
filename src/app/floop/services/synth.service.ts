import { EventEmitter, Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, ReplaySubject } from 'rxjs';
import { AMSynthOptions, FMSynth, FMSynthOptions, MembraneSynthOptions, PolySynthOptions, SynthOptions } from 'tone';

import * as Tone from 'tone/build/esm';
import { Instrument } from 'tone/build/esm/instrument/Instrument';
import { SynthEvent, SynthInstrument, SynthInstrumentType, SynthSequence, SynthSequenceEvent, SynthSong, SynthTrigger } from '../types/synth.types';


export const synthInstrumentTypeMap:Record<SynthInstrumentType, { class:any, label:string }> = {
	// TODO: disabled ones need extra configuration support
	'synth': { class: Tone.Synth, label: 'Synth' },
	'am': { class: Tone.AMSynth, label: 'AM' },
	'fm': { class: Tone.FMSynth, label: 'FM' },
	'membrane': { class: Tone.MembraneSynth, label: 'Membrane' },
	'metal': { class: Tone.MetalSynth, label: 'Metal' },
	'mono': { class: Tone.MonoSynth, label: 'Mono' },
//	'noise': { class: Tone.NoiseSynth, label: 'Noise' },
//	'pluck': { class: Tone.PluckSynth, label: 'Pluck' },
//	'poly': { class: Tone.PolySynth, label: 'Poly' },
};


@Injectable( {
	providedIn: 'any',
} )
export class SynthService{


	public events = new EventEmitter<SynthEvent>();
	public stateChange = new BehaviorSubject<Tone.PlaybackState>( 'stopped' );

	/** song is the "source of truth" for everything */
	public song:SynthSong;

	/** number of steps per sequence (16) */
	public stepCount = 16;
	/** number of beats per bar (4)*/
	public beatsPerBar = this.stepCount / 4;


	/** references to instruments used in the song */
	public instruments:SynthInstrument[] = [];
	public instruments$ = new BehaviorSubject<SynthService['instruments']>( [] );
	public synthInstrumentUpdate$ = new EventEmitter<{track:number, instrument:SynthInstrument, synth:Instrument<any>}>();

	/** holds the Tone Instruments / synths related to our instruments */
	public synths:Instrument<any>[] = [];
	public synths$ = new BehaviorSubject<SynthService['synths']>( [] );

	public stepDuration:Tone.Unit.Time = '4n';
	public defaultTriggerDuration:Tone.Unit.Time = '8n';
	public defaultTriggerNote:Tone.Unit.Note = 'C4';

	/**
	 * list of events by step and sequence, mainly used for quick playback related things
	 * [sequenceNumber][stepNumber][events]
	 * {
	 * 		[seq:number]: {
	 * 			[step:number]:
	 * 				{event:SynthSequenceEvent, instrument:number}[]
	 * 		}
	 * 	}
	 * */
	public playbackMatrix:Array<Array<Array<{ event:SynthSequenceEvent, instrument:number }>>> = [];

	public master!:Tone.Gain;

	public get masterVolume():number{
		return 100 / this.master.gain.value;
	}

	public set masterVolume( value:number ){
		this.master.gain.value = value / 100;
	}

	public get bpm():number{
		return Tone.Transport.bpm.value;
	}

	public set bpm( value:number ){
		Tone.Transport.bpm.value = value;
	}

	constructor(){
		this.song = SynthService.blankSong();
		this._updateMatrix();
	}

	/**
	 * initializes the audio context and prepares the transport
	 */
	public async ready():Promise<void>{
		try{
			await Tone.start();
			this.master = new Tone.Gain().toDestination();

			Tone.Transport.on( 'start', () => this.stateChange.next( 'started' ) );
			Tone.Transport.on( 'pause', () => this.stateChange.next( 'paused' ) );
			Tone.Transport.on( 'stop', () => this.stateChange.next( 'stopped' ) );

			Tone.Transport.bpm.value = 200;

			this._updatePlayback();

			Tone.Transport.loop = true;
			Tone.Transport.loopStart = '0m';
			Tone.Transport.loopEnd = '4m';

			return Promise.resolve();
		}catch( error ){
			console.warn( 'Audio context not started!', error );
			return Promise.reject( error );
		}
	}


	public playPause(){
		if( Tone.Transport.state === 'started' )
			this.pause();
		else
			this.play();

		return Tone.Transport.state;
	}

	public play(){
		Tone.Transport.start();
	}

	public pause(){
		Tone.Transport.pause();
	}

	public stop(){
		Tone.Transport.stop();
	}



	public addInstrument( instrument:SynthInstrument ):number{
		this.instruments.push( instrument );
		const instrumentNum = this.instruments.length - 1;

		this._updateInstrumentSynth( instrumentNum );

		this.song.tracks.push( {
			instrument,
			sequences: { 0: { steps: {} } },
		} );


		this._updateMatrix();

		this.instruments$.next( this.instruments );

		return instrumentNum;
	}


	public setSequence( instrument:number, sequence:number, sequenceData:SynthSequence ):SynthSequence{
		this.song.tracks[instrument].sequences[sequence] = sequenceData;

		if( !this.playbackMatrix[sequence] )
			this.playbackMatrix[sequence] = [];
		else{
			// remove previous triggers for instrument in the sequence
			this._removeInstrumentFromMatrixSequence( instrument, sequence );
		}

		// add steps to matrix
		for( const [ stepNum, event ] of Object.entries( sequenceData.steps ) ){
			const step = +stepNum;
			if( !this.playbackMatrix[sequence][step] )
				this.playbackMatrix[sequence][step] = [];
			this.playbackMatrix[sequence][step].push( { instrument, event } );
		}

		return this.song.tracks[instrument].sequences[sequence];
	}

	public getSequence( instrument:number, sequence:number ):SynthSequence{
		return this.song.tracks[instrument].sequences[sequence];
	}

	private _haveSequence( instrument:number, sequence:number ){
		return this.getSequence( instrument, sequence )
			|| this.setSequence( instrument, sequence, { steps: {} } );
	}



	public static bpmToMS( bpm:number ):number{
		return 60000 / bpm;
	}



	public static blankSong():SynthSong{
		return { tracks: [] };
	}



	/** updates the matrix based on the song data */
	private _updateMatrix( onlyInstrument?:number){
		if( onlyInstrument == null)
			this.playbackMatrix = [];
		else
			this._removeInstrumentFromMatrix( onlyInstrument );

		for( const [ trackNum, track ] of Object.entries( this.song.tracks ) ){
			if( onlyInstrument != null && onlyInstrument !== +trackNum )
				continue;

			for( const [ seqNum, sequence ] of Object.entries( track.sequences ) ){
				if( !this.playbackMatrix[+seqNum] )
					this.playbackMatrix[+seqNum] = [];

				for( const [ step, event ] of Object.entries( sequence.steps ) ){
					const stepNum = +step;

					if( !this.playbackMatrix[+seqNum][stepNum] )
						this.playbackMatrix[+seqNum][stepNum] = [];

					this.playbackMatrix[+seqNum][stepNum].push( { instrument: +trackNum, event } );
				}
			}
		}
	}

	private _removeInstrumentFromMatrixStep( instrument:number, sequence:number, step:number ){
		if( !this.playbackMatrix[sequence]?.[step] )
			return;

		this.playbackMatrix[sequence][step] =
			this.playbackMatrix[sequence][step]
				.filter( event => event.instrument !== instrument );
	}

	private _removeInstrumentFromMatrixSequence( instrument:number, sequence:number ){
		for( const stepNum of Object.keys( this.playbackMatrix[sequence] ) )
			this._removeInstrumentFromMatrixStep( instrument, sequence, +stepNum );
	}

	private _removeInstrumentFromMatrix( instrument:number ){
		for( const seqNum of Object.keys( this.playbackMatrix ) )
			this._removeInstrumentFromMatrixSequence( instrument, +seqNum );
	}



	/** adds a step if none is present or removes the current one */
	public toggleStep( instrument:number, sequence:number, step:number, trigger?:SynthTrigger ):SynthSequenceEvent | undefined{
		const sequenceStep = this.song.tracks[instrument].sequences[sequence]?.steps[step];

		if( sequenceStep ){
			this.removeStep( instrument, sequence, step );
			return undefined;
		}

		return this.setStep( instrument, sequence, step, trigger || {} );
	}

	/** adds / updates a step  */
	public setStep( instrument:number, sequence:number, step:number, trigger:SynthTrigger ):SynthSequenceEvent | undefined{
		const instrumentSequence = this._haveSequence( instrument, sequence );
		instrumentSequence.steps[step] = { trigger };

		// remove current from matrix
		this._removeInstrumentFromMatrixStep( instrument, sequence, step );
		if( !this.playbackMatrix[sequence][step] )
			this.playbackMatrix[sequence][step] = [];

		// add to matrix (
		this.playbackMatrix[sequence][step].push( { instrument, event: { trigger } } );
		this._updatePlayback();

		return instrumentSequence.steps[step];
	}

	public getSequenceEvent( instrument:number, sequence:number, step:number ):SynthSequenceEvent|undefined{
		return this.song.tracks[instrument]?.sequences[sequence]?.steps[step];
	}

	/** removes a step  */
	private removeStep( instrument:number, sequence:number, step:number ){
		// remove from song
		if( this.song.tracks[instrument]?.sequences[sequence]?.steps[step] )
			delete this.song.tracks[instrument]?.sequences[sequence]?.steps[step];

		// remove from matrix
		this._removeInstrumentFromMatrixStep( instrument, sequence, step );
		this._updatePlayback();
	}


	/** for directly triggering an instrument outside of Transport schedule */
	public triggerInstrument( instrumentNum:number, trigger:SynthTrigger = {} ){
		const instrument = this.instruments[instrumentNum];
		const synth = this.synths[instrumentNum];
		const time = Tone.now();

		Tone.Draw.schedule(
			() => this._sendInstrumentEvent( instrumentNum, trigger ),
			time,
		);

		this._triggerSynth( synth, trigger, time );
	}

	private _triggerSynth( synth:Instrument<any>, trigger:SynthTrigger, sequence?:number, step?:number, time?:Tone.Unit.Time ){
		synth.triggerAttackRelease(
			trigger.note || this.defaultTriggerNote,
			trigger.duration || this.defaultTriggerDuration,
			time,
		);
	}


	/** updates events in tone playback based on tracks in song */
	private _updatePlayback(){
		const wasPlaying = Tone.Transport.state === 'started';
		if( wasPlaying )
			Tone.Transport.pause();
		Tone.Transport.cancel();

		const stepDuration = this.stepDuration.toString();

		const maxSequence = Object.keys( this.playbackMatrix ).map( k => +k ).sort().reverse()[0];
		for( let sequence = 0 ; sequence <= maxSequence ; sequence++ ){
			for( let step = 0 ; step < this.stepCount ; step++ ){
				const stepTime = { '1m': sequence, [stepDuration]: step };
				const stepEvents = this.playbackMatrix[sequence]?.[step];

				// schedule playback triggers
				Tone.Transport.schedule( time => {

					if( stepEvents )
						for( const seqEvent of stepEvents ){
							this._triggerSynth(
								this.synths[seqEvent.instrument],
								seqEvent.event.trigger,
								sequence,
								step,
								time,
							);
						}


					// schedule events for external internactions
					Tone.Draw.schedule( () => {
						// send beat
						this.events.next( { type: 'beat', step, sequence } );

						// trigger playback events
						if( stepEvents )
							for( const seqEvent of stepEvents )
								this._sendInstrumentEvent( seqEvent.instrument, seqEvent.event.trigger, sequence, step );

					}, time );
				}, stepTime );

			}
		}

		if( wasPlaying )
			Tone.Transport.start();
	}


	private _sendInstrumentEvent( instrument:number, trigger:SynthTrigger, sequence?:number, step?:number ){
		this.events.next( {
			type: 'trigger',
			instrument,
			trigger,
			sequence,
			step,
		} );
	}


	public static defaultInstruments():SynthInstrument[]{
		const instruments:SynthInstrument[] = [];

		instruments.push( {
			label: 'kick',
			type: 'membrane',
			class: Tone.MembraneSynth,
			options: <MembraneSynthOptions> {
				pitchDecay: 0.008,
				octaves: 1,
				envelope: {
					attack: 0.0006,
					decay: 0.5,
					sustain: 0,
				},
			},
		} );

		instruments.push( {
			label: 'Harmonics',
			type: 'am',
			class: Tone.AMSynth,
			options: <AMSynthOptions> {
				'harmonicity': 3.999,
				'oscillator': {
					'type': 'square',
				},
				'envelope': {
					'attack': 0.03,
					'decay': 0.3,
					'sustain': 0.7,
					'release': 0.8,
				},
				'modulation': {
					'volume': 12,
					'type': 'square6',
				},
				'modulationEnvelope': {
					'attack': 2,
					'decay': 3,
					'sustain': 0.8,
					'release': 0.1,
				},
			},
		} );

		instruments.push( {
			label: 'wind',
			type: 'synth',
			class: Tone.Synth,
			options: <SynthOptions> {
				'portamento': 0.0,
				'oscillator': {
					'type': 'square4',
				},
				'envelope': {
					'attack': 2,
					'decay': 1,
					'sustain': 0.2,
					'release': 2,
				},
			},
		} );


		//		instruments.push( {
		//			label: 'synth',
		//			synth: new Tone.PolySynth( Tone.Synth, {
		//				oscillator: {
		//					type: 'fatsawtooth',
		//					count: 3,
		//					spread: 30,
		//				},
		//				envelope: {
		//					attack: 0.01,
		//					decay: 0.1,
		//					sustain: 0.5,
		//					release: 0.4,
		//					attackCurve: 'exponential',
		//				},
		//			} ),
		//		} );

		instruments.push( {
			label: 'kalimba',
			type: 'synth',
			class: Tone.PolySynth,
			options: <any> {
				options: {
					'harmonicity': 8,
					'modulationIndex': 2,
					'oscillator': {
						'type': 'sine',
					},
					'envelope': {
						'attack': 0.001,
						'decay': 2,
						'sustain': 0.1,
						'release': 2,
					},
					'modulation': {
						'type': 'square',
					},
					'modulationEnvelope': {
						'attack': 0.002,
						'decay': 0.2,
						'sustain': 0,
						'release': 0.2,
					},
				},
			},
		} );

		return instruments;
	}


	/** plays - you guessed it - a jingle */
	public playJingle(){

		const durations:Record<string, Tone.Unit.Time> = { s: '16n', i: '8n', q: '4n', h: '2n', n: '1n', N: '1m' };
		const jingles = [
			[ 'D5q', 'B4q', 'A4h', , 'B4h', 'A4h' ],
			[ 'C5q', 'E5i', 'G5i', , , 'C6i' ],
		];

		const synth = new Tone.DuoSynth( {
			/*
						voice0:{
							"oscillator": {
								"type": "pulse",
								"width" : 0.8
							},
							"envelope": {
								"attack": 0.01,
								"decay": 0.05,
								"sustain": 0.2,
								"releaseCurve" : "bounce",
								"release": 0.4
							},
						}
			*/
		} ).toDestination();
		synth.volume.value = -8;

		const notes = jingles[1];
		let time = Tone.now();

		notes.forEach( ( str, num ) => {
			if( !str ) // nothing = default break
				str = 'i';

			if( str.length === 1 ){ // just a break
				time = time + Tone.Time( durations[str] ).toSeconds();
				return;
			}

			const [ note, durationKey ] = [ str.substring( 0, 2 ), str.slice( -1 ) ];
			const duration = durations[durationKey];

			synth.triggerAttackRelease( note, duration, time );

			time = time + Tone.Time( duration ).toSeconds();
		} );

	}

	public getContext(){
		return Tone.getContext();
	}

	public updateInstrument( instrumentNum:number, changes:SynthInstrument ){
		Object.assign( this.instruments[instrumentNum], changes );
		this._updateInstrumentSynth( instrumentNum );

		this.instruments$.next( this.instruments );

		this.synthInstrumentUpdate$.emit({
			track: instrumentNum,
			instrument: this.instruments[instrumentNum],
			synth: this.synths[instrumentNum]
		});
	}

	private _updateInstrumentSynth( instrumentNum:number ):Instrument<any>{
		// cleanup existing
		if( this.synths[instrumentNum] ){
			this._removeInstrumentFromMatrix( instrumentNum );
			this.synths[instrumentNum].disconnect();
			this.synths[instrumentNum].dispose();
			delete this.synths[instrumentNum];
		}

		const instrument = this.instruments[instrumentNum];

		const synth = new ( instrument.class )( instrument.options );
		this.synths[instrumentNum] = synth;

		// connect to master lane
		synth.connect( this.master );

		this._updateMatrix( instrumentNum );
		this._updatePlayback();

		this.synths$.next( this.synths );

		return synth;
	}

	public async resetSong(){
		for( const track of this.song.tracks ){
			track.sequences = [];
		}
		this._updateMatrix();
		this._updatePlayback();
	}

	public async saveSong(){
		const buffer = JSON.stringify( this.song );
		return Preferences.set({key:'floop.song.0', value: buffer});
	}


	public async loadSong( num = 0 ){
		const { value:buffer } = await Preferences.get({key:'floop.song.'+ num });
		if( !buffer )
			throw new Error('no such song');

		try{
			const data = JSON.parse(buffer);
			this.importSong( data );

		}catch( error ){
			console.error('problem parsing song data', error);
			throw new Error('song data invalid');
		}

		return this.song;
	}

	private importSong( data:SynthSong ){
		this.stop();

		this.song = data;
		this._recreateInstruments();
		this._updateMatrix();
		this._updatePlayback();
	}

	private _recreateInstruments(){
		// CONTINUE
	}
}
