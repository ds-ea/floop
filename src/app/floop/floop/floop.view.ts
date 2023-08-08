import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import * as Tone from 'tone/build/esm';
import { SynthSequence, SynthService, SynthSong, SynthTrack } from '../services/synth.service';


type ControlType = 'instrument' | 'track';
type BtnData = {
	type?:'control' | 'trigger' | 'viz' | 'instrument' | 'track' | undefined;

	num?:number;
	row:number;
	col:number;

	step?:number;
	instrument?:number;

	on?:boolean;
	hl?:boolean;

	label?:string;
	icon?:string;

	action?:CallableFunction;
};



@Component( {
	selector: 'floop',
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: 'floop.view.html',
} )
export class FloopView implements OnInit{

	public powered = false;
	public ready = false;


	public controlButtons:BtnData[] = [];
	public controlMatrix:Record<ControlType, {
		buttons:{ [col:number]:BtnData },
		pager?:BtnData,
		control?:BtnData
	}> = { instrument: { buttons: {} }, track: { buttons: {} } };

	public sequencerButtons:BtnData[] = [];
	public sequencerMatrix:{ [row:number]:{ [col:number]:BtnData } } = {};
	public stepMatrix:{ btn:BtnData }[] = [];
	public stepCount = 16;
	public beatsPerBar = this.stepCount / 4;

	public bpm = 200;
	public dir = 1;

	public prevStep:number | undefined;
	public currentStep:number = -1;

	public currentInstrument!:number;
	public currentSequence!:number;

	public sequence:SynthSequence|undefined;

	constructor(
		private cdr:ChangeDetectorRef,
		private renderer:Renderer2,
		private synth:SynthService,
		private el:ElementRef,
	){

		this._prepButtons();

		this.synth.events
			.subscribe( event => {
				if( event.type === 'beat' ){
//					const [seq, beat] = event.position.split(':',3);
//					const step = (+seq * this.beatsPerBar) + (+beat) ;
					this.animateStep( event.step );
				}
			});


		// TODO: update instrument init when instrument creation functionality exists
		for( const instrument of this.synth.defaultInstruments() )
			this.synth.addInstrument( instrument );

		this._updateInstruments();
		this.selectInstrument( 0 );

	}


	ngOnInit(){
		if( !this.powered ){
			this.el.nativeElement.addEventListener( 'click', ( event:MouseEvent ) => {
				event.stopPropagation();
				event.preventDefault();
				this.onOff();
			}, { once: true } );
		}
	}



	public async onOff(){
		this.powered = !this.powered;
		this.cdr.markForCheck();

		if( this.powered ){
			await this.synth.ready();
			this.ready = true;
		}else{
			this.ready = false;
		}

		this.cdr.markForCheck();
	}

	public playPause(){
		this.synth.playPause();
	}


	private _prepButtons(){
		const colCount = 6;

		// /////////////////////////////////////////////////////////
		// controls

		// instrument buttons
		for( let col = colCount ; col > 0 ; col-- ){
			let row = 1;
			const btn:BtnData = {
				type: 'instrument',
				row, col,
			};
			this.controlMatrix.instrument.buttons[col - 1] = btn;
			this.controlButtons.push( btn );
		}

		// track pager
		this.controlMatrix.track.pager = { type: 'control', row: 0, col: 0 };
		this.controlButtons.push( this.controlMatrix.track.pager! );

		// track buttons
		for( let col = 1 ; col < colCount - 1 ; col++ ){
			let row = 0;
			const btn:BtnData = {
				type: 'track',
				row, col,
			};
			this.controlMatrix.track.buttons[col] = btn;
			this.controlButtons.push( btn );
		}

		// track loop
		this.controlMatrix.track.pager = { type: 'control', row: 0, col: 0, label: 'loop' };
		this.controlButtons.push( this.controlMatrix.track.pager! );



		// /////////////////////////////////////////////////////////
		// sequencer grid
		const rowCount = 6;

		for( let row = rowCount - 1 ; row >= 0 ; row-- ){
			this.sequencerMatrix[row] = {};

			for( let col = 0 ; col < colCount ; col++ ){
				const num = ( row ) * colCount + col + 1;

				const btn:BtnData = {
					num,
					row,
					col,
				};

				this.sequencerMatrix[row][col] = btn;
				this.sequencerButtons.push( btn );

			}
		}


		// set types
		// bottom and top row
		for( const row of [ 0, rowCount - 1 ] ){
			for( let col = 1 ; col < colCount - 1 ; col++ )
				this.sequencerMatrix[row][col].type = 'trigger';

			this.sequencerMatrix[row][0].type = 'control';
			this.sequencerMatrix[row][colCount - 1].type = 'control';
		}
		// in between
		for( let row = 1 ; row < rowCount - 1 ; row++ ){
			this.sequencerMatrix[row][0].type = 'trigger';
			this.sequencerMatrix[row][colCount - 1].type = 'trigger';

			for( let col = 1 ; col < colCount - 1 ; col++ )
				this.sequencerMatrix[row][col].type = 'viz';
		}

		// assign steps
		let step = 0;
		for( let col = 1 ; col < colCount - 1 ; col++ ){
			const btn = this.sequencerMatrix[0][col];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}

		// right side
		for( let row = 1 ; row < rowCount - 1 ; row++ ){
			const btn = this.sequencerMatrix[row][colCount - 1];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}
		// top row
		for( let col = colCount - 2 ; col > 0 ; col-- ){
			const btn = this.sequencerMatrix[rowCount - 1][col];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}

		// left side
		for( let row = rowCount - 2 ; row > 0 ; row-- ){
			const btn = this.sequencerMatrix[row][0];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}
		if( step !== this.stepCount )
			throw new Error( 'step count mismatch during button init' );


		// set controls
		Object.assign( this.sequencerMatrix[rowCount - 1][0], {
			label: 'playpause',
			icon: 'play',
			action: () => this.playPause(),
		} );

		Object.assign( this.sequencerMatrix[rowCount - 1][colCount - 1], {
			label: 'reverse',
			icon: 'swap-horizontal',
			action: () => this.dir *= -1,
		} );

	}


	public tapButton( btn:BtnData, event?:TouchEvent | MouseEvent | any ){

		if( btn.action ){
			Haptics.impact( { style: ImpactStyle.Medium } );
			btn.action();
		}

		if( btn.type === 'trigger' ){
			return this._tapTrigger( btn, event );
		}


		if( btn.type === 'instrument' ){
			return this._tapInstrument( btn );
		}

	}



	private _tapTrigger( btn:BtnData, event?:TouchEvent | MouseEvent | any ){
		Haptics.impact( { style: ImpactStyle.Light } );

		if( btn.step != null )
			this.toggleStep( btn.step );

	}

	private _tapInstrument( btn:BtnData ){
		if( btn.instrument != null )
			this.selectInstrument( btn.instrument );
	}


	public selectInstrument( instrumentNum:number ){
		this.currentInstrument = instrumentNum;
		this.selectSequence();

		// highlight instrument button
		for( const btn of Object.values( this.controlMatrix.instrument.buttons) )
			btn.on = btn.instrument === this.currentInstrument;
	}

	/**
	 * updates the instrument buttons based on current instruments
	 */
	private _updateInstruments(){
		for( const [ num, instr ] of Object.entries( this.synth.instruments ) ){
			this.controlMatrix.instrument.buttons[+num].instrument = +num;
			this.controlMatrix.instrument.buttons[+num].label = instr.label;
		}
		this.cdr.markForCheck();
	}

	/**
	 * updates sequence buttons to reflect current sequence setup
	 */
	private _updateSequence(){
		this.sequence = this.synth.getSequence( this.currentInstrument, this.currentSequence );
		this.stepMatrix.forEach( ({btn}) => btn.on = !!this.sequence?.steps[btn.step!] );
	}

	private selectSequence( sequenceNumber?:number ){
		sequenceNumber = sequenceNumber ?? this.currentSequence ?? 0;

		if( sequenceNumber != this.currentSequence )
			this.currentSequence = sequenceNumber;

		this._updateSequence();
	}


	public toggleStep( step:number ){
		const event = this.synth.toggleStep( this.currentInstrument, this.currentSequence, step );

		this.stepMatrix[ step ].btn.on = !!event;
	}


	private animateStep( step:number ){
		if( this.prevStep != null ){
			const prevBtn = this.stepMatrix[this.prevStep].btn;
			prevBtn.hl = false;
		}

		this.currentStep = step;

		const btn = this.stepMatrix[this.currentStep].btn;
		btn.hl = true;

		this.prevStep = this.currentStep;
//		requestAnimationFrame( () => {});
		this.cdr.detectChanges();

	}

	public trackButtonNumber( index:number, btn:BtnData ):number{
		return btn.num!;
	}
}
