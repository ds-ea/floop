import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import formatters from 'chart.js/dist/core/core.ticks';
import { AMOscillatorOptions, Envelope, EnvelopeOptions, MembraneSynth, OmniOscillator, OmniOscillatorOptions, Synth, SynthOptions } from 'tone';
import { Instrument } from 'tone/build/esm/instrument/Instrument';
import { SynthInstrument, SynthInstrumentType } from '../../../types/synth.types';
import { FloopDisplayInstrumentPageComponent } from './instrument-screen.component';

import { Chart } from 'chart.js/auto';


@Component( {
	selector: 'envelope-page',
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

		<section class="viz">
			<canvas #canvas></canvas>
		</section>

		<section class="config-wrap" *ngIf="options">

			<div class="config-grid centered" *ngIf="envOptions; else noEnvelope">

				<div class="cell-1">
					<input-stepper class="compact"
								   [(ngModel)]="envOptions.attack"
								   (ngModelChange)="out()"
								   direction="vertical"
								   [min]="0" [max]="2"
								   [increment]=".02"
					></input-stepper>
					<label>att</label>
				</div>

				<div class="cell-1">
					<input-stepper class="compact"
								   [(ngModel)]="envOptions.decay"
								   (ngModelChange)="out()"
								   direction="vertical"
								   [min]="0" [max]="2"
								   [increment]=".02"
					></input-stepper>
					<label>dec</label>
				</div>

				<div class="cell-1">
					<input-stepper class="compact"
								   [(ngModel)]="envOptions.release"
								   (ngModelChange)="out()"
								   direction="vertical"
								   [min]="0" [max]="5"
								   [increment]=".05"
					></input-stepper>
					<label>rls</label>
				</div>

				<div class="cell-1">
					<input-stepper class="compact"
								   [(ngModel)]="envOptions.sustain"
								   (ngModelChange)="out()"
								   direction="vertical"
								   [min]="0" [max]="1"
								   [increment]=".01"
					></input-stepper>
					<label>sus</label>
				</div>

			</div>
			<ng-template #noEnvelope>
				<div class="callout">no envelope</div>
			</ng-template>
		</section>
	`,
} )

export class EnvelopePage implements FloopDisplayInstrumentPageComponent, OnInit, OnChanges, OnDestroy{
	@ViewChild( 'canvas', { read: ElementRef, static: true } ) canvas!:ElementRef<HTMLCanvasElement>;


	@Input() instrument:SynthInstrument | undefined;
	@Output() instrumentChange = new EventEmitter<SynthInstrument | undefined>;

	@Input() instrSynth?:Synth<any>;

	public options!:SynthOptions;
	public envOptions!:Omit<EnvelopeOptions, 'context'>;

	private chart:any;

	constructor(
		private cdr:ChangeDetectorRef,
		private elementRef:ElementRef,
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
		if( 'instrument' in changes )
			this._applyOptions();

		if( this.instrSynth )
			this._draw();
	}


	private _applyOptions(){
		if( !this.instrument )
			return;

		this.options = this.instrument?.options as any || {};
		this.envOptions = this.options?.envelope as EnvelopeOptions;
		this._populateOptionsFromSynth();

		this.cdr.markForCheck();

	}

	private _populateOptionsFromSynth(){
		if( !this.instrument || !this.instrSynth )
			return;

		if( !this.instrument.options ){
			this.instrument.options = {} as any;
			this.options = this.instrument.options as any;
		}

		if( !this.options!.envelope ){
			this.options!.envelope = {} as any;
			this.envOptions = this.options!.envelope as EnvelopeOptions;
		}

		if( this.instrSynth.envelope ){
			this.envOptions.attack = this.instrSynth.envelope.attack;
			this.envOptions.decay = this.instrSynth.envelope.decay;
			this.envOptions.sustain = this.instrSynth.envelope.sustain;
			this.envOptions.release = this.instrSynth.envelope.release;
		}

		this._draw();
	}

	private async _draw(){
		if( !this.canvas?.nativeElement || !this.instrSynth?.envelope )
			return;

		const color = getComputedStyle( this.elementRef.nativeElement ).getPropertyValue( '--flp-ui-chart-color' );
		const gridColor = getComputedStyle( this.elementRef.nativeElement ).getPropertyValue( '--flp-ui-divider-color' );
		const env = this.instrSynth.envelope as Envelope;


		const values = await env.asArray( this.canvas.nativeElement.width / 2 )!;

		let labels:any[] = [...values];

		if( this.chart ){
			this.chart.data.datasets[0].data = values;
			this.chart.data.datasets[0].borderColor = color;
			this.chart.update();
			return;
		}

		// hacky border thing
		const chartAreaBorder = {
			id: 'chartAreaBorder',
			beforeDraw(chart:any, args:any, options:any) {
				const {ctx, chartArea: {left, top, width, height}} = chart;
				ctx.save();
				ctx.strokeStyle = options.borderColor;
				ctx.lineWidth = options.borderWidth;
				ctx.strokeRect(left, top, width, height);
				ctx.restore();
			}
		};

		this.chart = new Chart( this.canvas.nativeElement,
			{
				type: 'line',
				plugins: [chartAreaBorder],
				data: {
					labels: labels,
					datasets: [
						{
							data: values,
							fill: false,
							borderColor: color,
							showLine: true,
							//							tension: 0.1,
						},
					],
				},
				options: {
					maintainAspectRatio: false,
					elements: {
						point: {
							radius: 0,
						},
					},
					scales: {
						x: {
							display: true,
							border: { display: true, color: gridColor },
							grid: { display: false, color: gridColor },
							ticks:{ display: false}
						},
						y: {
							display: true,
							border: { display: true, color: '#333' },
							grid: { display: false, color: '#333' },
							ticks:{ display: false}
						},
					},
					plugins: {
						tooltip: { enabled: false },
						legend: { display: false },
						title: { display: false },
						chartAreaBorder: {
							borderColor: gridColor,
							borderWidth: 1,
						}
					} as any,
				},
			},
		);


	}
}
