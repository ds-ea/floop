export type ControlType = 'instrument' | 'track';
export type BtnData = {
	type?:'control' | 'trigger' | 'fx' | 'instrument' | 'track' | undefined;

	num?:number;
	row:number;
	col:number;

	step?:number;
	instrument?:number;

	on?:boolean;
	hl?:boolean;
	blink?:boolean;

	label?:string;
	icon?:string;

	action?:CallableFunction;
};


export type FloopSettings = {
	quickBoot?:boolean;
	loadSongAfterBoot?:boolean;
	deviceVolume?:number;
}

export type FloopMemory = {
	lastInstrumentPage?:string;
};
