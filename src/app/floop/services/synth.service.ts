import { EventEmitter, Injectable } from '@angular/core';

import * as Tone from 'tone/build/esm';
import { Instrument } from 'tone/build/esm/instrument/Instrument';


export type SynthInstrument = {
	label:string;
	synth:Instrument<any>;
};


export type SynthTrigger = {
	trigger?:'default';
	note?:Tone.Unit.Frequency;
	duration?:Tone.Unit.Time;
	velocity?:Tone.Unit.NormalRange;
};

/** a thing that happens in a step (currently triggering a trigger) */
export type SynthSequenceEvent = {
	trigger:SynthTrigger;
};

/** one sequence (phrase) */
export type SynthSequence = {
	steps:{
		[step:number]:SynthSequenceEvent;
	};
};


/** a track (often treated like a slot for / an instrument ) */
export type SynthTrack = {
	instrument:SynthInstrument;
	sequences:{
		[sequence:number]:SynthSequence;
	};
};

/** a song with all data for doing things */
export type SynthSong = {
	tracks:SynthTrack[];
};


/**
 * an event the synth itself fires for others to do something with
 */
export type SynthEvent = {
	type:'trigger';
	instrument:number;
	trigger:SynthTrigger;
	sequence?:number;
	step?:number;
	time?:Tone.Unit.Time;
} | {
	type:'beat',
	step:number;
	sequence:number;
};


@Injectable( {
	providedIn: 'any',
} )
export class SynthService{


	public events = new EventEmitter<SynthEvent>();

	/** song is the "source of truth" for everything */
	public song:SynthSong;

	/** number of steps per sequence (16) */
	public stepCount = 16;
	/** number of beats per bar (4)*/
	public beatsPerBar = this.stepCount / 4;


	/** references to instruments used in the song */
	public instruments:SynthInstrument[] = [];

	/** holds the Tone Instruments / synths related to our instruments */
	public synths:Instrument<any>[] = [];

	public stepDuration:Tone.Unit.Time = '4n';
	public defaultTriggerDuration:Tone.Unit.Time = '8n';

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

			Tone.Transport.bpm.value = 200;

			this._updateTone();

			Tone.Transport.loop = true;
			Tone.Transport.loopStart = '0m';
			Tone.Transport.loopEnd = '4m';

//			Tone.Transport.on( 'loop', ( ...args ) => {
//				console.log( 'transport loop', args );
//			} );

			console.debug( 'synth ready' );

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
		this.synths.push( instrument.synth );

		// connect to audio
		instrument.synth.toDestination();

		this.song.tracks.push( {
			instrument,
			sequences: { 0: { steps: {} } },
		} );


		this._updateMatrix();

		return this.instruments.length - 1;
	}


	public setSequence( instrument:number, sequence:number, sequenceData:SynthSequence ):SynthSequence{
		this.song.tracks[instrument].sequences[sequence] = sequenceData;

		if( !this.playbackMatrix[sequence] )
			this.playbackMatrix[sequence] = [];
		else{
			// remove previous triggers for instrument in the sequence
			this._removeInstrumentFromMatrixSequence(instrument, sequence);
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
	private _updateMatrix(){
		this.playbackMatrix = [];

		for( const [ trackNum, track ] of Object.entries( this.song.tracks ) ){
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
		for( const stepNum of Object.keys(this.playbackMatrix[sequence]) )
			this._removeInstrumentFromMatrixStep( instrument, sequence, +stepNum );
	}



	/** adds a step if none is present or removes the current one */
	public toggleStep( instrument:number, sequence:number, step:number, trigger?:SynthTrigger ):SynthSequenceEvent | undefined{
		const sequenceStep = this.song.tracks[instrument].sequences[ sequence ]?.steps[step];

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
		this.playbackMatrix[sequence][step].push({instrument, event: { trigger }})
		this._updateTone();

		return instrumentSequence.steps[step];
	}

	/** removes a step  */
	private removeStep( instrument:number, sequence:number, step:number ){
		// remove from song
		if( this.song.tracks[ instrument ]?.sequences[ sequence ]?.steps[ step ] )
			delete this.song.tracks[ instrument ]?.sequences[ sequence ]?.steps[ step ];

		// remove from matrix
		this._removeInstrumentFromMatrixStep( instrument, sequence, step );
		this._updateTone();
	}


	/** for directly triggering an instrument outside of Transport schedule */
	public triggerInstrument( instrumentNum:number, trigger:SynthTrigger = {} ){
		const instrument = this.instruments[instrumentNum];

		this._triggerSynth( instrument, trigger, Tone.now() );
	}

	private _triggerSynth( instrument:SynthInstrument, trigger:SynthTrigger, sequence?:number, step?:number, time?:Tone.Unit.Time ){
		instrument.synth.triggerAttackRelease(
			trigger.note || 'C4',
			trigger.duration || this.defaultTriggerDuration,
			time,
		);
	}


	/** updates events in tone playback based on tracks in song */
	private _updateTone(){
		const wasPlaying = Tone.Transport.state === 'started';
		if( wasPlaying )
			Tone.Transport.pause();
		Tone.Transport.cancel();

		const stepDuration = this.stepDuration.toString();

		const maxSequence = Object.keys(this.playbackMatrix).map(k=>+k).sort().reverse()[0];
		for( let sequence = 0 ; sequence <= maxSequence ; sequence++ ){
			for( let step = 0 ; step < this.stepCount ; step++ ){
				const stepTime = { '1m': sequence, [stepDuration]: step };
				const stepEvents = this.playbackMatrix[ sequence ]?.[step];

				// schedule playback triggers
				Tone.Transport.schedule( time => {

					if( stepEvents )
						for( const seqEvent of stepEvents ){
							this._triggerSynth(
								this.instruments[seqEvent.instrument],
								seqEvent.event.trigger,
								sequence,
								step,
								time,
							);
						}


					// schedule events for external internactions
					Tone.Draw.schedule(()=>{
						// send beat
						this.events.next({type: 'beat', step, sequence});

						// trigger playback events
						if( stepEvents )
							for( const seqEvent of stepEvents )
								this.events.next({
									type: 'trigger',
									instrument: seqEvent.instrument,
									trigger: seqEvent.event.trigger,
									sequence,
									step,
								});
					}, time );
				}, stepTime);

			}
		}

		if( wasPlaying )
			Tone.Transport.start();
	}



	public static defaultInstruments():SynthInstrument[]{
		const instruments:SynthInstrument[] = [];



		instruments.push( {
			label: 'kick',
			synth: new Tone.MembraneSynth( {
				pitchDecay: 0.008,
				octaves: 1,
				envelope: {
					attack: 0.0006,
					decay: 0.5,
					sustain: 0,
				},
			} ),
		} );



		instruments.push( {
			label: 'Harmonics',
			synth: new Tone.AMSynth( {
				"harmonicity": 3.999,
				"oscillator": {
					"type": "square"
				},
				"envelope": {
					"attack": 0.03,
					"decay": 0.3,
					"sustain": 0.7,
					"release": 0.8
				},
				"modulation" : {
					"volume" : 12,
					"type": "square6"
				},
				"modulationEnvelope" : {
					"attack": 2,
					"decay": 3,
					"sustain": 0.8,
					"release": 0.1
				}
			} ),
		} );

		instruments.push( {
			label: 'wind',
			synth: new Tone.Synth( {
				"portamento" : 0.0,
				"oscillator": {
					"type": "square4"
				},
				"envelope": {
					"attack": 2,
					"decay": 1,
					"sustain": 0.2,
					"release": 2
				}
			} ),
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
			synth: new Tone.PolySynth( Tone.FMSynth, {
				"harmonicity":8,
				"modulationIndex": 2,
				"oscillator" : {
					"type": "sine"
				},
				"envelope": {
					"attack": 0.001,
					"decay": 2,
					"sustain": 0.1,
					"release": 2
				},
				"modulation" : {
					"type" : "square"
				},
				"modulationEnvelope" : {
					"attack": 0.002,
					"decay": 0.2,
					"sustain": 0,
					"release": 0.2
				}
			} ),
		} );

		return instruments;
	}

}
