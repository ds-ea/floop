import { state } from '@angular/animations';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, Renderer2, ViewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Animation, StatusBar } from '@capacitor/status-bar';
import { AnimationController } from '@ionic/angular';
import { Color } from 'chart.js';
import { settings } from 'ionicons/icons';
import { debounce, timer } from 'rxjs';
import { PlaybackState } from 'tone';
import { FloopDeviceService } from '../services/floop-device.service';
import { SynthService } from '../services/synth.service';
import { BtnData, ControlType } from '../types/floop.types';
import { SynthSequence, SynthTrigger } from '../types/synth.types';

import { lighten, mix } from 'color2k';


type FloopFXImpulse = {
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

@Component( {
	selector: 'floop',
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: 'floop.view.html',
} )
export class FloopView implements OnInit, AfterViewInit{
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
	public fxMatrix:{
		el:HTMLElement;
		colors?:Color[];
		/** incoming value 0 - 1*/
		in:number;
		/** current value 0 - 1*/
		v:number;
		/** fx propagation*/
		impulses:FloopFXImpulse[];
	}[][] = [];
	private _fxMatrixImpulses:FloopFXImpulse[] = [];

	public bpm = 200;
	public dir = 1;

	public prevStep:number | undefined;
	public currentStep:number = -1;

	public currentInstrument!:number;
	public currentSequence!:number;

	public sequence:SynthSequence | undefined;

	public dynamicContent:'viz' | 'boot' | 'settings' | 'instrument' | 'song' | undefined;

	private _powerOnTouchHandler:CallableFunction | undefined;

	private _inited = false;

	private _fxOn:boolean = false;
	private _fxFPS:number = 30;
	private _fxLoop:number | undefined;

	public showTrackNav = false;

	constructor(
		private cdr:ChangeDetectorRef,
		private renderer:Renderer2,
		private synth:SynthService,
		private floopDevice:FloopDeviceService,
		private el:ElementRef,
		private animCtrl:AnimationController,
	){

		Device.getInfo().then( info => {
			if( info.platform !== 'web' )
				StatusBar.hide( { animation: Animation.Fade } );
		} );

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
			} );

	}


	ngOnInit(){
		if( !this.powered ){
			this._powerOnTouchHandler = () => this._touchAnythingToPowerOn();
			this.el.nativeElement.addEventListener( 'click', this._powerOnTouchHandler, { once: true } );
		}
	}

	public ngAfterViewInit():void{
		// add fx buttons into array for direct dom manipulation
		const fxButtons = Array.from<HTMLElement>( this.el.nativeElement.querySelectorAll( '.btn' ) )
			.filter( ( btn ) => btn.classList.contains( 'fx' ) );

		for( const btnEl of fxButtons ){
			const row = btnEl.getAttribute( 'data-row' );
			const col = btnEl.getAttribute( 'data-col' );

			if( row == null || col == null )
				continue;

			if( !this.fxMatrix[+row] )
				this.fxMatrix[+row] = [];
			this.fxMatrix[+row][+col] = {
				v: 0,
				in: 0,
				el: btnEl,
				colors: [],
				impulses: [],
			};
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
		this.dynamicContent = 'instrument';
		this.cdr.markForCheck();
	}

	/** for initializing things that are dependent on audio context and other async stuff */
	private async _initDevice(){
		const settings = await this.floopDevice.restoreSettings();
		this.instantOn = this.instantOn || !!settings?.quickBoot;

		await this.synth.ready();

		if( settings?.deviceVolume != null )
			this.synth.masterVolume = settings?.deviceVolume;

		// TODO: update instrument init when instrument creation functionality exists
		if( settings?.loadSongAfterBoot ){
			await this.synth.loadSong();

		}

		if( !this._inited ){
			for( const instrument of SynthService.defaultInstruments() )
				this.synth.addInstrument( instrument );

			this._updateInstruments();
			this.selectInstrument( 0 );
		}

		this._inited = true;
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

		if( this.showTrackNav ){
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
		}



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
				this.sequencerMatrix[row][col].type = 'fx';
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


		///////////////////////////
		// set controls

		const playPauseButton = this.sequencerMatrix[rowCount - 1][0];
		Object.assign( playPauseButton, {
			label: 'playpause',
			icon: 'play',
			action: () => this.playPause(),
		} );
		this.synth.stateChange.pipe(
			takeUntilDestroyed(),
			debounce( () => timer( 50 ) ),
		).subscribe( state => {
			const stateIconMap:Record<PlaybackState, string> = {
				paused: 'play',
				stopped: 'play',
				started: 'pause',
			};
			playPauseButton.icon = stateIconMap[state];
			this.cdr.detectChanges();
		} );

		Object.assign( this.sequencerMatrix[rowCount - 1][colCount - 1], {
			label: 'song',
			icon: 'musical-notes',
			action: () => this.dynamicContent = 'song',
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


		// listen for instrument changes
		this.synth.instruments$
			.pipe( takeUntilDestroyed() )
			.subscribe( instruments => {
				if( instruments )
					this._updateInstruments();
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

		if( btn.type === 'fx' ){
			return this._tapFX( btn );
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

		if( btn.on){
			const colRowLimit = this.fxMatrix.length+1;
			const fxRow = btn.row === 0 ? 1 : btn.row === colRowLimit ? colRowLimit-1 : btn.row ;
			const fxCol = btn.col === 0 ? 1 : btn.col === colRowLimit ? colRowLimit-1 : btn.col ;
			this._tapFX({row: fxRow, col: fxCol});
		}

		this.prevStep = this.currentStep;
		this.cdr.detectChanges();

	}

	private animateInstrument( instrument:number, trigger?:SynthTrigger ){
		const btn = this.controlMatrix.instrument.buttons[instrument];
		if( !btn )
			return;

		btn.blink = false;
		this.cdr.detectChanges();
		setTimeout( () => {
			btn.blink = true;
			this.cdr.detectChanges();
		} );

	}


	/** helper for improving a bit of DOM performance via trackBy pipe */
	public trackButtonNumber( index:number, btn:BtnData ):number{
		return btn.num!;
	}

	private _tapFX( btn:Pick<BtnData, 'row' | 'col'> ){

		const fxRow = btn.row - 1;
		const fxCol = btn.col - 1;
		const fxBtn = this.fxMatrix[fxRow][fxCol];

		this._fxMatrixImpulses.push( {
			juice: .8,
			state: 'spawn',
			row: fxRow,
			col: fxCol,
		} );

		this.animateFX();
	}

	private animateFX(){
		if( this.floopDevice.settings.disableFX )
			return;
		this._startFX();
	}

	private _startFX(){
		this._fxOn = true;
		this._animateFX();

	}

	private _stopFX(){
		this._fxOn = false;
		if( this._fxLoop != null )
			clearTimeout( this._fxLoop );
	}

	private _animateFX(){
		if( this._fxLoop != null )
			clearTimeout( this._fxLoop );

		// these are separate since data logic should generally be independent of draw calls
		this._updateFX();
		this._drawFX();

		// in case the setting was changed while animations are running
		if( this.floopDevice.settings.disableFX )
			return;

		// schedule next tick
		this._fxLoop = setTimeout( this._animateFX.bind( this ), 1000 / this._fxFPS );
	}


	private _placeImpulse( impulse:FloopFXImpulse ):FloopFXImpulse{
		// place in matrix
		this.fxMatrix[ impulse.row ][ impulse.col ].impulses.push( impulse );
		return impulse;
	}

	private _spawnImpulse( row:number, col:number, direction:'up'|'down'|'left'|'right', data:Partial<FloopFXImpulse> = {}):FloopFXImpulse{
		const impulse:FloopFXImpulse = {
			state: 'alive',
			juice: 1,
			...data,
			row, col,
		};

		if( direction === 'up' )
			impulse._y = 1;
		else if( direction === 'down' )
			impulse._y = -1;
		else if( direction === 'left' )
			impulse._x = -1;
		else if( direction === 'right' )
			impulse._x = 1;


		return impulse;
	}

	private _updateImpulse( impulse:FloopFXImpulse ):FloopFXImpulse{
		const defaultVelocity = 2;
		const falloff = .3;

		const rows = this.fxMatrix.length;
		const cols = this.fxMatrix[0].length;
		const topRow = rows - 1;
		const lastCol = cols - 1;

		if( impulse._res == null )
			impulse._res = 0;

		const stationary = !!impulse._x && !!impulse._y;



		let moved= impulse._res === 0;

		// update resident timer
		impulse._res++;

		// move is necessary
		if( !stationary && impulse._res > (impulse.velocity ?? defaultVelocity) ){
			// remove from old
			this.fxMatrix[impulse.row][impulse.col].impulses =
				this.fxMatrix[impulse.row][impulse.col].impulses
					.filter(imp => imp !== impulse);

			if( impulse._x != null )
				impulse.col += impulse._x;
			if( impulse._y != null )
				impulse.row += impulse._y;

			// colliding with boundaries currently kills the impulse
			if( impulse.row < 0 || impulse.row > topRow || impulse.col < 0 || impulse.col > lastCol){
				impulse.state = 'dead';
				return impulse;
			}

			// move to next cell
			this.fxMatrix[ impulse.row ][ impulse.col ].impulses.push( impulse );
			impulse.juice -= falloff;

			moved = true;

		}



		if( moved || stationary ){
			// apply effects
			const cell = this.fxMatrix[ impulse.row ][ impulse.col ];
			cell.in += impulse.juice;

			// stationary impulses leave no trail, so they just spend everything in one place
			if( stationary )
				impulse.juice = 0;
		}

		// if impulses run out of juice, they die
		if( impulse.juice <= 0 )
			impulse.state = 'dead';

		return impulse;
	}

	private _updateFX(){
		const rows = this.fxMatrix.length;
		const cols = this.fxMatrix[0].length;
		const topRow = rows - 1;
		const lastCol = cols - 1;

		const lightUpSpeed = 5 / this._fxFPS;
		const decaySpeed = .3 / this._fxFPS;
		const falloff = .25;


		// cleanup in case
		if( this.floopDevice.settings.disableFX ){
			this._fxMatrixImpulses = [];
			for( let row = 0 ; row < rows ; row++ ){
				for( let col = 0 ; col < cols ; col++ ){
					const btn = this.fxMatrix[row][col];
					btn.in = 0;
					btn.v = 0;
					btn.impulses = [];
				}
			}

			return;
		}




		const matrix = this.fxMatrix;
		const unprocessedImpulses = [ ...this._fxMatrixImpulses ];
		// propagate impulses
		while( unprocessedImpulses.length ){
			const impulse = unprocessedImpulses.shift();
			if( !impulse )
				continue;

			if( impulse.state === 'spawn' ){
				// TODO: highlight spawn cell
				const spawned:FloopFXImpulse[] = [];

				const juice = impulse.juice - impulse.juice * falloff;

				if( impulse.row < topRow ) // spawn a pulse going up
					spawned.push(this._spawnImpulse(impulse.row+1, impulse.col, 'up', {juice}));
				if( impulse.row > 0 ) // spawn a pulse going down
					spawned.push(this._spawnImpulse(impulse.row-1, impulse.col, 'down', {juice}));

				if( impulse.col > 0 ) // spawn a pulse going left
					spawned.push(this._spawnImpulse(impulse.row, impulse.col-1, 'left', {juice}));
				if( impulse.col < lastCol ) // spawn a pulse going right
					spawned.push(this._spawnImpulse(impulse.row, impulse.col+1, 'right', {juice}));


				for( const newImpulse of spawned ){
					this._placeImpulse( newImpulse );
					this._fxMatrixImpulses.push( newImpulse );
					unprocessedImpulses.push(newImpulse);
				}

				// change to alive, so it decays by itself
				impulse.state = 'alive';
				impulse.juice = .8;
			}

			// process pulse
			this._updateImpulse( impulse );

		}
		// remove dead impulses
		this._fxMatrixImpulses = this._fxMatrixImpulses.filter( impulse => impulse.state !== 'dead' );


		// process incoming value
		for( let row = 0 ; row < rows ; row++ ){
			for( let col = 0 ; col < cols ; col++ ){
				const btn = this.fxMatrix[row][col];
				if( btn.in ){
					const increaseBy = lightUpSpeed;
					btn.in = Math.max( 0, btn.in - increaseBy );
					btn.v = Math.min( 1, btn.v + increaseBy );

				}
			}
		}

		// decay (only if no input)
		for( let row = 0 ; row < rows ; row++ ){
			for( let col = 0 ; col < cols ; col++ ){
				const btn = this.fxMatrix[row][col];
				if( btn.v ){
					const decreaseBy = Math.min( decaySpeed, btn.v );
					btn.v = Math.max( 0, btn.v - decreaseBy );
				}

			}
		}
	}

	private _drawFX(){
//		const fxColorLow = '#100226';
		const fxColorLow = '#270060';
		const fxColorHigh = '#ff0038';

		const rows = this.fxMatrix.length;
		const cols = this.fxMatrix[0].length;

		for( let row = 0 ; row < rows ; row++ ){
			for( let col = 0 ; col < cols ; col++ ){
				const btn = this.fxMatrix[row][col];

				if( btn.v ){
					const color = mix( fxColorLow, fxColorHigh, FloopView.easeInSine(btn.v) );
					this.renderer.setStyle( btn.el, 'background-color', color );
				}else{
					this.renderer.removeStyle( btn.el, 'background-color' );
				}

			}
		}
	}

	private static easeInSine(x: number): number {
		return 1 - Math.cos((x * Math.PI) / 2);
	}


}
