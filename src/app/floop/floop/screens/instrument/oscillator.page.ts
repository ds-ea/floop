import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { synthInstrumentTypeMap } from '../../../services/synth.service';
import { SynthInstrument, SynthInstrumentType } from '../../../types/synth.types';
import { FloopDisplayInstrumentPageComponent } from './instrument-screen.component';



@Component( {
	selector: 'oscillator-page',
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


					</div>
				</ion-item>
			</ion-list>

		</ng-container>
	`,
} )

export class OscillatorPage implements FloopDisplayInstrumentPageComponent, OnInit, OnChanges{
	@Input() instrument:SynthInstrument | undefined;
	@Output() instrumentChange = new EventEmitter<SynthInstrument | undefined>;


	constructor(
		private cdr:ChangeDetectorRef,
	){ }

	public out(){
		this.instrumentChange.emit( this.instrument );
	}

	public ngOnInit():void{
	}


	public ngOnChanges( changes:SimpleChanges ):void{
		if( 'instrument' in changes ){
//			this.instrumentType = this.instrument?.type;
			this.cdr.markForCheck();
		}
	}


	public changeType(){
		if( !this.instrument )
			return;

//		if( !this.instrumentType || !this.instrumentTypes[this.instrumentType] )
//			throw new Error( 'unsupported instrument type selected' );
//
//		this.instrument.type = this.instrumentType;
//		this.instrument.class = this.instrumentTypes[this.instrumentType].class;
		this.out();
	}
}
