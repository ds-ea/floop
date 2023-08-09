import * as Tone from 'tone';
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
