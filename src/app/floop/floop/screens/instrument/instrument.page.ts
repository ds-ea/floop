import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Synth } from 'tone';
import { synthInstrumentTypeMap } from '../../../services/synth.service';
import { SynthInstrument, SynthInstrumentType } from '../../../types/synth.types';
import { FloopDisplayInstrumentPageComponent } from './instrument-screen.component';

import * as Tone from 'tone/build/esm';

@Component( {
	selector: 'instrument-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<header>
			<h1>Instrument Setup</h1>
		</header>

		<ng-container *ngIf="instrument">

			<ion-list lines="full" class="transparent">
				<ion-item>
					<ion-input
							[(ngModel)]="instrument.label"
							(ngModelChange)="out()"
							label="Label"
					></ion-input>
				</ion-item>
				<ion-item>
					<div class="inner-grid">
						<ion-label class="segment-margin">Type</ion-label>
						<ion-segment
								[(ngModel)]="instrumentType"
								(ngModelChange)="changeType()"
								class="multi-line"
						>
							<ion-segment-button
									*ngFor="let item of instrumentTypes | keyvalue"
									[value]="item.key"
							>{{item.value.label}}</ion-segment-button>
						</ion-segment>
					</div>
				</ion-item>
				<ion-item>
					<div slot="end">
						{{volume|number:'1.0-0'}} dB
						<ion-icon *ngIf="volume!=null"
								  [name]="
								volume < -15 ? 'volume-off' : (
								volume < -10 ? 'volume-low' : (
								volume < -2 ? 'volume-medium' : 'volume-high'
								))
						"></ion-icon>
					</div>
					<ion-range aria-label="Volume"
							   labelPlacement="start" label="Volume"
							   [(ngModel)]="volume"
							   (ngModelChange)="setInstrumentValue($event)"
							   min="-20" max="5"
							   step="1"
					>
					</ion-range>
				</ion-item>
			</ion-list>

		</ng-container>
	`,
} )

export class InstrumentPage implements FloopDisplayInstrumentPageComponent, OnInit, OnChanges{
	public instrumentTypes = synthInstrumentTypeMap;

	@Input() instrument:SynthInstrument | undefined;
	@Output() instrumentChange = new EventEmitter<SynthInstrument | undefined>;

	@Input() instrSynth?:Synth<any>;

	public instrumentType:SynthInstrumentType | undefined;
	public volume: Tone.Unit.Decibels | undefined;

	constructor(
		private cdr:ChangeDetectorRef,
	){ }

	public out(){
		this.instrumentChange.emit( this.instrument );
	}

	public ngOnInit():void{
		this.instrumentType = this.instrument?.type;
	}


	public ngOnChanges( changes:SimpleChanges ):void{
		if( 'instrument' in changes ){
			this.instrumentType = this.instrument?.type;
			this.cdr.markForCheck();
		}
		if( 'instrSynth' in changes ){
			this.volume = this.instrSynth?.volume.value;
			this.cdr.markForCheck();
		}

	}


	public changeType(){
		if( !this.instrument )
			return;

		if( !this.instrumentType || !this.instrumentTypes[this.instrumentType] )
			throw new Error( 'unsupported instrument type selected' );

		this.instrument.type = this.instrumentType;
		this.instrument.class = this.instrumentTypes[this.instrumentType].class;
		this.out();
	}

	public setInstrumentValue( $event:any ){
		if( !this.instrument || this.volume == null )
			return;
		this.instrument.options.volume = this.volume;
		this.out();
	}
}
