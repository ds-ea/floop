import * as Tone from 'tone';
import { AMSynthOptions, DuoSynthOptions, FMSynthOptions, MembraneSynthOptions, MetalSynthOptions, MonoSynthOptions, NoiseSynthOptions, PluckSynthOptions, PolySynthOptions, SamplerOptions, SynthOptions } from 'tone';


export type SynthInstrumentType =
	| 'synth'
	| 'am'
	| 'fm'
	| 'membrane'
	| 'metal'
	| 'mono'
//	| 'noise'
//	| 'pluck'
//	| 'poly'
	;

export type SynthInstrumentClasses =
	| Tone.AMSynth
	| Tone.DuoSynth
	| Tone.FMSynth
	| Tone.MembraneSynth
	| Tone.MetalSynth
	| Tone.MonoSynth
	| Tone.NoiseSynth
	| Tone.PluckSynth
	| Tone.Sampler
	| Tone.PolySynth
	| Tone.Synth
	;

type SynthInstrumentOptions<T> =
	T extends Tone.AMSynth ? AMSynthOptions :
	T extends Tone.DuoSynth ? DuoSynthOptions :
	T extends Tone.FMSynth ? FMSynthOptions :
	T extends Tone.MembraneSynth ? MembraneSynthOptions :
	T extends Tone.MetalSynth ? MetalSynthOptions :
	T extends Tone.MonoSynth ? MonoSynthOptions :
	T extends Tone.NoiseSynth ? NoiseSynthOptions :
	T extends Tone.PluckSynth ? PluckSynthOptions :
	T extends Tone.Sampler ? SamplerOptions :
	T extends Tone.PolySynth<infer U> ? PolySynthOptions<U> :
	T extends Tone.Synth ? SynthOptions :
	never
	;

// TODO: inference is currently borked
export type SynthInstrument<TInstrument extends SynthInstrumentClasses = any, TInstrumentOptions extends SynthInstrumentOptions<TInstrument> = SynthInstrumentOptions<TInstrument>> = {
	label:string;
	type:SynthInstrumentType;
	class?:TInstrument;
	options:TInstrumentOptions;
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
} |
	{
		type:'beat',
		step:number;
		sequence:number;
	};
