import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import formatters from 'chart.js/dist/core/core.ticks';
import { AMOscillatorOptions, MembraneSynth, OmniOscillator, OmniOscillatorOptions, SynthOptions } from 'tone';
import { Instrument } from 'tone/build/esm/instrument/Instrument';
import { SynthInstrument, SynthInstrumentType } from '../../../types/synth.types';
import { FloopDisplayInstrumentPageComponent } from './instrument-screen.component';

import { Chart } from 'chart.js/auto';


const oscOptionsMapper:Record<string | 'fallback', {
	srcAttrib?:string;

	/** attributes to read from actual instrument into options */
	read?:string[];

} | undefined> = {
	synth: undefined,
	am: undefined,
	fm: undefined,
	//	membrane: {
	//		srcAttrib: 'oscillator',
	//		read: ['frequency', 'detune', 'phase' ]
	//	},
	metal: undefined,
	mono: undefined,
	pluck: undefined,
	poly: undefined,

	fallback: {
		srcAttrib: 'oscillator',
		read: [ 'type', 'frequency', 'detune', 'phase' ],
	},
};



@Component( {
	selector: 'oscillator-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [
		`
			canvas {
				width: 100%;
				height: 100%;
				image-rendering: pixelated;
			}
		`,
	],
	template: `
		<!--<header>
			<h1>Oscillators</h1>
		</header>-->

		<section class="viz">
			<div class="scope-preview">
				<canvas #canvas></canvas>
			</div>
		</section>

		<section class="config-wrap" *ngIf="options">

			<div class="config-grid" *ngIf="oscillatorOptions; else noOscillator">
				<div class="grid-row full">
					<label class="cell-1">type</label>
					<ul class="segmented-options cell-3">
						<li *ngFor="let type of oscillatorTypes"
							[class.selected]="oscillatorOptions.type === type.key"
							(click)="changeOscillatorType(type.key)"
						>
							{{type.label}}
						</li>
					</ul>
				</div>

				<label class="cell-1">frq</label>
				<input-stepper class="cell-1 compact"
							   [(ngModel)]="oscillatorOptions.frequency"
							   (ngModelChange)="out()"
				></input-stepper>

				<label class="cell-1">det</label>
				<input-stepper class="cell-1 compact"
							   [(ngModel)]="oscillatorOptions.detune"
							   (ngModelChange)="out()"
				></input-stepper>

				<label class="cell-1">phase</label>
				<input-stepper class="cell-1 compact"
							   [(ngModel)]="oscillatorOptions.phase"
							   (ngModelChange)="out()"
				></input-stepper>
			</div>
			<ng-template #noOscillator>
				<div class="callout">no oscillator</div>
			</ng-template>
		</section>
	`,
} )

export class OscillatorPage implements FloopDisplayInstrumentPageComponent, OnInit, OnChanges, OnDestroy{
	@ViewChild( 'canvas', { read: ElementRef } ) canvas!:ElementRef<HTMLCanvasElement>;


	@Input() instrument:SynthInstrument | undefined;
	@Output() instrumentChange = new EventEmitter<SynthInstrument | undefined>;

	@Input() instrSynth?:Instrument<any>;

	public oscillatorTypes:{ key:string, label:string, icon?:string }[] = [
		{ key: 'sine', label: 'sin' },
		{ key: 'square', label: 'sqr' },
		{ key: 'sawtooth', label: 'saw' },
		{ key: 'triangle', label: 'tri' },
	];

	public options!:SynthOptions;
	public oscillatorOptions!:OmniOscillatorOptions;

	private chart:any;

	constructor(
		private cdr:ChangeDetectorRef,
		private elementRef:ElementRef
	){ }

	public out(){
		this.instrumentChange.emit( this.instrument );
	}

	public ngOnInit():void{
		if( this.instrSynth )
			this._draw();

		this._applyOptions();
	}

	public ngOnDestroy():void{
		if( this.chart )
			this.chart.destroy();
	}


	public ngOnChanges( changes:SimpleChanges ):void{
		if( 'instrument' in changes ){
			this._applyOptions();
		}

		if( this.instrSynth )
			this._draw();
	}


	private _applyOptions(){
		if( !this.instrument )
			return;

		this.options = this.instrument?.options as any || {};
		this.oscillatorOptions = this.options?.oscillator as OmniOscillatorOptions;
		this._populateOptionsFromSynth();

		this.cdr.markForCheck();

	}

	public changeOscillatorType( key:string ){
		if( !this.oscillatorOptions )
			return;

		this.oscillatorOptions.type = key as OscillatorType;

		this.cdr.markForCheck();
		this.out();
	}



	private _populateOptionsFromSynth(){
		if( !this.instrument || !this.instrSynth)
			return;

		if( !this.instrument.options ){
			this.instrument.options = {} as any;
			this.options = this.instrument.options as any;
		}

		if( !this.options!.oscillator ){
			this.options!.oscillator = {} as any;
			this.oscillatorOptions = this.options!.oscillator as any;
		}

		if( !this.oscillatorOptions || typeof this.oscillatorOptions !== 'object' )
			return;

		const instr:MembraneSynth = this.instrSynth! as any;

		const mapper = oscOptionsMapper[instr?.name] || oscOptionsMapper['fallback'];
		const srcAttrib = mapper?.srcAttrib as keyof MembraneSynth;
		if( !srcAttrib || !mapper || !instr)
			return;

		const oscSrc = srcAttrib in instr ? instr[srcAttrib] as OmniOscillator<any> : undefined;
		if( oscSrc ){
			if( mapper.read ){
				const keys = mapper.read as ( keyof OmniOscillator<any> )[];
				for( const key of keys ){
					let v = oscSrc[key] as any;
					if( typeof v === 'object' && 'value' in v )
						v = v['value'];

					//@ts-ignore
					this.oscillatorOptions[key as keyof OmniOscillatorOptions] = v;
				}
			}
		}

	}

	private async _draw(){
		if( !this.instrSynth )
			return;


		const color = getComputedStyle( this.elementRef.nativeElement ).getPropertyValue('--flp-ui-chart-color');

		const oscillator = 'oscillator' in this.instrSynth ? this.instrSynth['oscillator'] as OmniOscillator<any> : undefined;

		let values = await oscillator?.asArray( 200 );
		if( !values?.length ){
			if( this.chart ){
				this.chart.data.datasets[0].data = [];
				this.chart.update();
			}
			return;
		}

		const v = [...values!];

		if( this.chart ){
			this.chart.data.datasets[0].data = v;
			this.chart.data.datasets[0].borderColor = color;
			this.chart.update();
			return;
		}

		const labels = Array( values.length ).fill(1);
		this.chart = new Chart( this.canvas.nativeElement,
			{
				type: 'line',
				data: {
					labels,
					datasets: [
						{
							data: v,
							fill: false,
							borderColor: color,
							showLine: true,
//							tension: 0.1,
						},
					],
				},
				options: {
					maintainAspectRatio: false,
					elements:{
						point:{
							radius: 0
						}
					},
					scales: {
						x: {
							display: false,
							border: { display: false, },
							grid: { display: false, },
						},
						y: { display: false, },
					},
					plugins: {
						tooltip: {enabled: false},
						legend: { display: false, },
						title: { display: false, },
					},
				},
			},
		);


	}
}
