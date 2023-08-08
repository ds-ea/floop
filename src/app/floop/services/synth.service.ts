import { EventEmitter, Injectable } from '@angular/core';

import * as Tone from 'tone/build/esm';
import { Instrument } from 'tone/build/esm/instrument/Instrument';

export type SynthInstrument = {
	label:string;
	synth:Tone.Synth | Tone.PolySynth;
};

export type SynthTrigger = {
	trigger?:'default';
	note?:Tone.Unit.Frequency;
	duration?:Tone.Unit.Time;
	velocity?:Tone.Unit.NormalRange;
};

export type SynthSequenceStep = {
	[step:number]:{trigger: SynthTrigger};
};

export type SynthSequence = {
	steps:SynthSequenceStep;
};


export type SynthTrack = {
	instrument:SynthInstrument;
	sequences:{
		[sequence:number]:SynthSequence;
	};
};

export type SynthSong = {
	tracks:SynthTrack[];
};


export type SynthEvent = {
	type:'trigger';
	instrument:SynthInstrument;
	trigger:SynthTrigger;
	sequence?:number;
	step?:number;
	time?:Tone.Unit.Time;
} | {
	type: 'beat',
	step: number;
	/** measure:beat:something */
	position?: Tone.Unit.BarsBeatsSixteenths;
};


@Injectable( {
	providedIn: 'any',
} )
export class SynthService{


	public events = new EventEmitter<SynthEvent>();

	/** song is the "source of truth" for everything */
	public song:SynthSong;

	/** references to instruments used in the song */
	public instruments:SynthInstrument[] = [];

	/** holds the Tone Instruments / synths related to our instruments */
	public synths:Instrument<any>[] = [];

	public stepTime:Tone.Unit.Time = '4n';

	/** references to sequences by their number and instrument */
	public triggerMatrix:{
		[sequence:number]:{
			[instrument:number]:SynthSequence
		}
	} = {};


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

			Tone.Transport.on('loop', (...args)=>{
				console.log('transport loop', args);
			});

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


	public setSequence( instrument:number, sequence:number, data:SynthSequence ):SynthSequence{
		this.song.tracks[instrument].sequences[sequence] = data;

		if( !this.triggerMatrix[sequence] )
			this.triggerMatrix[sequence] = {};
		this.triggerMatrix[sequence][instrument] = this.song.tracks[instrument].sequences[sequence];

		return this.song.tracks[instrument].sequences[sequence];
	}

	public getSequence( instrument:number, sequence:number ):SynthSequence{
		return this.triggerMatrix[sequence][instrument];
	}

	private _haveSequence( instrument:number, sequence:number ){
		return this.getSequence( instrument, sequence )
			|| this.setSequence( instrument, sequence, { steps: {} } );
	}



	public static bpmToMS( bpm:number ):number{
		return 60000 / bpm;
	}


	public defaultInstruments():SynthInstrument[]{
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
			label: 'conga',
			synth: new Tone.MembraneSynth( {
				pitchDecay: 0.008,
				octaves: 2,
				envelope: {
					attack: 0.0006,
					decay: 0.5,
					sustain: 0,
				},
			} ),
		} );


		instruments.push( {
			label: 'synth',
			synth: new Tone.PolySynth( Tone.Synth, {
				oscillator: {
					type: 'fatsawtooth',
					count: 3,
					spread: 30,
				},
				envelope: {
					attack: 0.01,
					decay: 0.1,
					sustain: 0.5,
					release: 0.4,
					attackCurve: 'exponential',
				},
			} ),
		} );

		return instruments;
	}



	public static blankSong():SynthSong{
		return { tracks: [] };
	}



	/** updates the matrix based on the song data */
	private _updateMatrix(){
		this.triggerMatrix = {};
		for( const [ trackNum, track ] of Object.entries( this.song.tracks ) ){
			for( const [ sequenceNum, sequence ] of Object.entries( track.sequences ) ){
				if( !this.triggerMatrix[+sequenceNum] )
					this.triggerMatrix[+sequenceNum] = {};

				this.triggerMatrix[+sequenceNum][+trackNum] = sequence;
			}
		}
	}


	/** adds a step if none is present or removes the current one */
	public toggleStep( instrument:number, sequence:number, step:number, data?:SynthTrigger ):SynthSequenceStep | undefined{
		const sequenceStep = this.triggerMatrix[sequence]?.[instrument]?.steps[step];

		if( sequenceStep ){
			this.removeStep( instrument, sequence, step );
			return undefined;
		}

		return this.setStep( instrument, sequence, step, data || {} );
	}

	/** adds / updates a step  */
	public setStep( instrumentNum:number, sequenceNum:number, step:number, trigger:SynthTrigger ):SynthSequenceStep | undefined{
		const sequence = this._haveSequence( instrumentNum, sequenceNum );
		sequence.steps[step] = { trigger };

		this._updateTone();

		return sequence.steps[step];
	}

	/** removes a step  */
	private removeStep( instrument:number, sequence:number, step:number ){
		// NOTE: only updating matrix since the sequence is a ref to the one in the song
		const events = this.triggerMatrix[sequence]?.[instrument]?.steps;
		if( step in events )
			delete events[step];

		this._updateTone();
	}


	/** for directly triggering an instrument outside of Transport schedule */
	public triggerInstrument( instrumentNum:number, trigger:SynthTrigger = {} ){
		const instrument = this.instruments[ instrumentNum ];

		this._triggerSynth( instrument, trigger, Tone.now() );
	}

	private _triggerSynth( instrument:SynthInstrument, trigger:SynthTrigger, sequence?:number, step?:number, time?:Tone.Unit.Time ){

		Tone.Draw.schedule(()=>{
			this.events.next({ type: 'trigger',instrument, trigger, sequence,step,time });
		}, time || Tone.now() );

		instrument.synth.triggerAttackRelease(
			trigger.note || 'C4',
			trigger.duration || this.stepTime,
			time,
		);
	}


	/** updates events in tone playback based on tracks in song */
	private _updateTone(){
		Tone.Transport.cancel();

/*
		Tone.Transport.scheduleRepeat((...args)=>{
			const position = Tone.Transport.position as Tone.Unit.BarsBeatsSixteenths;
			Tone.Draw.schedule(()=>{
				this.events.next({type: 'beat', position});
			}, Tone.now())
		}, this.stepTime );
*/

		const beatLoop = new Tone.Loop((time)=>{
//			const position = Tone.Transport.position as Tone.Unit.BarsBeatsSixteenths;
			const step = Math.floor(Tone.Transport.getTicksAtTime(time)/192);
			Tone.Draw.schedule(()=>{
				this.events.next({type: 'beat', step});
			}, time);
		}, this.stepTime);
		beatLoop.start();



		const stepTime = this.stepTime.toString();

		for( const track of this.song.tracks ){
			const instrument = track.instrument;

			for( const [ sequenceNum, sequence ] of Object.entries( track.sequences ) ){
				for( const [ stepNum, step ] of Object.entries( sequence.steps ) ){
					Tone.Transport.schedule( time => {
						this._triggerSynth( instrument, step.trigger, +sequenceNum, +stepNum, time );
					}, {'1m': +sequenceNum, [stepTime]: +stepNum } );

				}
			}
		}
	}



}
