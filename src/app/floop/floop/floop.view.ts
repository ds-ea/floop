import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, Renderer2 } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AnimationController } from '@ionic/angular';
import { FloopDeviceService } from '../services/floop-device.service';
import { SynthService } from '../services/synth.service';
import { BtnData, ControlType, FloopSettings } from '../types/floop.types';
import { SynthSequence, SynthTrigger } from '../types/synth.types';



@Component( {
	selector: 'floop',
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: 'floop.view.html',
} )
export class FloopView implements OnInit{

	public powered = false;
	public ready = false;

	public bootDone:boolean = false;
	public instantOn = false;

	public controlButtons:BtnData[] = [];
	public controlMatrix:Record<ControlType, {
		buttons:{ [col:number]:BtnData },
		pager?:BtnData,
		control?:BtnData
	}> = { instrument: { buttons: {} }, track: { buttons: {} } };

	public sequencerButtons:BtnData[] = [];
	public sequencerMatrix:{ [row:number]:{ [col:number]:BtnData } } = {};
	public stepMatrix:{ btn:BtnData }[] = [];

	public bpm = 200;
	public dir = 1;

	public prevStep:number | undefined;
	public currentStep:number = -1;

	public currentInstrument!:number;
	public currentSequence!:number;

	public sequence:SynthSequence | undefined;

	public dynamicContent:'viz'|'boot'|'settings'|'instrument'|'song'|undefined;

	private _powerOnTouchHandler:CallableFunction|undefined;

	constructor(
		private cdr:ChangeDetectorRef,
		private renderer:Renderer2,
		private synth:SynthService,
		private floopDevice:FloopDeviceService,
		private el:ElementRef,
		private animCtrl:AnimationController
	){

		this._prepButtons();

		this.synth.events
			.subscribe( event => {
				if( event.type === 'beat' )
					this.animateStep( event.step );
				if( event.type === 'trigger' )
					this.animateInstrument( event.instrument, event.trigger );
			} );


		this.floopDevice.settingsChanged
			.subscribe( settings => {
				if( settings.deviceVolume != null )
					this.synth.masterVolume = settings.deviceVolume;
			});

	}


	ngOnInit(){
		if( !this.powered ){
			this._powerOnTouchHandler = () => this._touchAnythingToPowerOn();
			this.el.nativeElement.addEventListener( 'click', this._powerOnTouchHandler, { once: true } );
		}
	}

	private _touchAnythingToPowerOn( event?:Event ){
		if( event ){
				event.stopPropagation();
			event.preventDefault();
		}
		this.onOff();
	}


	public async onOff(){
		if( this._powerOnTouchHandler ){
			this.el.nativeElement.removeEventListener( 'click', this._powerOnTouchHandler );
			this._powerOnTouchHandler = undefined;
		}

		this.powered = !this.powered;
		this.cdr.markForCheck();

		if( this.powered ){
			await this._initDevice();

			this.ready = true;
			if( this.instantOn ){
				this.bootReady();
			}else{
				this.synth.playJingle();
				this.dynamicContent = 'boot';
			}
		}else{
			this.synth.stop();

			this.ready = false;
			this.bootDone = false;
			this.dynamicContent = undefined;
			this.instantOn = true;
		}

		this.cdr.markForCheck();
	}

	public bootReady(){
		this.bootDone = true;
		this.dynamicContent = 'viz';
		this.cdr.markForCheck();
	}

	/** for initializing things that are dependent on audio context and other async stuff */
	private async _initDevice(){
		const settings = await this.floopDevice.restoreSettings();
		this.instantOn = !!settings?.quickBoot;

		await this.synth.ready();

		if( settings?.deviceVolume != null )
			this.synth.masterVolume = settings?.deviceVolume;

		// TODO: update instrument init when instrument creation functionality exists
		for( const instrument of SynthService.defaultInstruments() )
			this.synth.addInstrument( instrument );

		this._updateInstruments();
		this.selectInstrument( 0 );
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
		if( step !== this.synth.stepCount )
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

		Object.assign( this.sequencerMatrix[0][0], {
			label: 'viz',
			icon: 'pulse-sharp',
			action: () => this.dynamicContent = 'viz',
		} );

		Object.assign( this.sequencerMatrix[0][colCount - 1], {
			label: 'settings',
			icon: 'settings-sharp',
			action: () => this.dynamicContent = 'settings',
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
		// if instrument is already selected, trigger sound and switch to appropriate view
		if( btn.instrument === this.currentInstrument ){
			this.synth.triggerInstrument( btn.instrument );

			if( this.dynamicContent !== 'instrument' )
				this.dynamicContent = 'instrument';

			return;
		}

		if( btn.instrument != null )
			this.selectInstrument( btn.instrument );
	}


	public selectInstrument( instrumentNum:number ){
		this.currentInstrument = instrumentNum;
		this.selectSequence();

		// highlight instrument button
		for( const btn of Object.values( this.controlMatrix.instrument.buttons ) )
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
		this.stepMatrix.forEach( ( { btn } ) => btn.on = !!this.sequence?.steps[btn.step!] );
	}

	private selectSequence( sequenceNumber?:number ){
		sequenceNumber = sequenceNumber ?? this.currentSequence ?? 0;

		if( sequenceNumber != this.currentSequence )
			this.currentSequence = sequenceNumber;

		this._updateSequence();
	}


	public toggleStep( step:number ){
		const event = this.synth.toggleStep( this.currentInstrument, this.currentSequence, step );

		this.stepMatrix[step].btn.on = !!event;
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
		this.cdr.detectChanges();

	}

	private animateInstrument( instrument:number, trigger?:SynthTrigger ){
		const btn = this.controlMatrix.instrument.buttons[instrument];
		if( !btn )
			return;

		btn.blink = false;
		this.cdr.detectChanges();
		setTimeout(()=>{
			btn.blink = true;
			this.cdr.detectChanges();
		});

	}


	/** helper for improving a bit of DOM performance via trackBy pipe */
	public trackButtonNumber( index:number, btn:BtnData ):number{
		return btn.num!;
	}



}
