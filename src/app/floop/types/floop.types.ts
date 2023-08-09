export type ControlType = 'instrument' | 'track';
export type BtnData = {
	type?:'control' | 'trigger' | 'viz' | 'instrument' | 'track' | undefined;

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
