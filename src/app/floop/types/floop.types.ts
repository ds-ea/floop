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
	selected?:boolean;
	blink?:boolean;

	icon?:string;
	label?:string;
	overlay?:string;
	overlayLabel?:string;
	overlayData?:unknown;
	overlayAction?:() => void;

	action?:CallableFunction;
};


export type FloopSettings = {
	quickBoot?:boolean;
	loadSongAfterBoot?:boolean;
	disableFX?:boolean;
	deviceVolume?:number;
}

export type FloopMemory = {
	lastInstrumentPage?:string;
};


export type FloopFXImpulse = {
	state:'spawn' | 'alive' | 'dead';

	velocity?:number;
	juice:number;

	// position
	row:number;
	col:number;

	// vector
	_x?:-1 | 1;
	_y?:-1 | 1;

	/** counter until advancing to next cell */
	_res?:number;
}


export type FloopStepEditData = {
	note:string;
	octave:number;
}
