import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import * as Tone from 'tone/build/esm';
import { SynthService } from '../services/synth.service';


type BtnData = {
	type?:'control' | 'trigger' | 'viz' | undefined;

	num:number;
	row:number;
	col:number;

	step?:number;

	on?:boolean;
	hl?:boolean;

};

@Component( {
	selector: 'floop',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<article class="floop-device">
			<div class="floop-frame">

				<header>
					<h1>floop v.0</h1>
				</header>
				<section class="floop-display control" #controlDisplay>

				</section>

				<section class="floop-display sequencer" #sequencerDisplay>
					<div class="retro"></div>
					<div class="panel">
						<div *ngFor="let btn of buttons"
							 [ngClass]="['btn', btn.type, btn.hl ? 'hl' : '', btn.on ? 'on' : 'off' ]"
							 [attr.data-btn-num]="btn.num"
						>
							<button (click)="tapButton(btn, $event)">
								num: {{btn.num}}
								<br />
								{{btn.type ?? '?'}}
								<br />
								{{btn.step ? 'step: ' + btn.step : ''}}
								<br />
								{{btn.on ? 'on' : 'off'}} :: {{btn.hl ? 'hl' : ''}}
							</button>
						</div>
					</div>
				</section>

			</div>
		</article>
	`,
} )
export class FloopView implements OnInit{

	public buttons:BtnData[] = [];
	public btnMatrix:{ [row:number]:{ [col:number]:BtnData } } = {};
	public stepMatrix:{ btn:BtnData }[] = [];
	public stepCount = 16;

	public bpm = 200;

	public instrument:Tone.Synth|undefined;

	constructor(
		private cdr:ChangeDetectorRef,
		private synth:SynthService
	){

		this._prepButtons();
	}


	ngOnInit(){

		let step = 0;
		let prevBtn:BtnData|undefined = undefined;

		setInterval(()=>{
			if( ++step >= this.stepCount )
				step = 0;
//			console.log(step);

			if( prevBtn )
				prevBtn.hl = false;

			const btn = this.stepMatrix[ step ].btn;
			btn.hl = true;

			if( btn.on )
				this.synth.test();

			prevBtn = btn;
			this.cdr.markForCheck();
		}, SynthService.bpmToMS(this.bpm) );


	}


	private _prepButtons(){
		const rowCount = 6;
		const colCount = 6;

		for( let row = rowCount - 1 ; row >= 0 ; row-- ){
			this.btnMatrix[row] = {};

			for( let col = 0 ; col < colCount ; col++ ){
				const num = ( row ) * colCount + col + 1;

				const btn:BtnData = {
					num,
					row,
					col
				};

				this.btnMatrix[row][col] = btn;
				this.buttons.push( btn );

			}
		}


		// set types
		// bottom and top row
		for( const row of [ 0, rowCount - 1 ] ){
			for( let col = 1 ; col < colCount - 1 ; col++ )
				this.btnMatrix[row][col].type = 'trigger';

			this.btnMatrix[row][0].type = 'control';
			this.btnMatrix[row][colCount - 1].type = 'control';
		}
		// in between
		for( let row = 1 ; row < rowCount - 1 ; row++ ){
			this.btnMatrix[row][0].type = 'trigger';
			this.btnMatrix[row][colCount - 1].type = 'trigger';

			for( let col = 1 ; col < colCount - 1 ; col++ )
				this.btnMatrix[row][col].type = 'viz';
		}

		// assign steps
		let step = 0;
		for( let col = 1 ; col < colCount - 1 ; col++ ){
			const btn = this.btnMatrix[0][col];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}

		// right side
		for( let row = 1 ; row < rowCount - 1 ; row++ ){
			const btn = this.btnMatrix[row][colCount - 1];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}
		// top row
		for( let col = colCount - 2 ; col > 0 ; col-- ){
			const btn = this.btnMatrix[rowCount - 1][col];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}

		// left side
		for( let row = rowCount - 2 ; row > 0 ; row-- ){
			const btn = this.btnMatrix[row][0];
			this.stepMatrix.push( { btn } );
			btn.step = step++;
		}
		if( step !== this.stepCount )
			throw new Error('step count mismatch during button init');


	}


	public tapButton( btn:BtnData, event?:TouchEvent|MouseEvent|any ){
		if( btn.type === 'trigger' ){

			btn.on = !btn.on;
			if( btn.on )
				this.synth.test();

			console.log('toch', btn, event);
			if( event && 'targetTouches' in event )
				for (let i = 0; i < event.targetTouches.length; i++) {
					console.log(`targetTouches[${i}].force = ${event.targetTouches[i].force}`);
				}
		}
	}

}
