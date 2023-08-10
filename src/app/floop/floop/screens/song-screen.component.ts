import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FloopDeviceService } from '../../services/floop-device.service';
import { SynthService } from '../../services/synth.service';


@Component( {
	selector: 'song-screen',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles:[`
		:host {
			display: flex;
			flex-direction: column;
			overflow: auto;

			justify-content: flex-start;
		}
		ion-list{
			--ion-border-color: #000000;
			padding: 0;
		}
		ion-item{
			--border-width: 0 0 4px 0 !important;
		}

	`],
	template: `

		<ion-spinner *ngIf="busy" name="circular"></ion-spinner>

		<ion-list *ngIf="!busy" lines="full">
			<ion-item >
				<input-stepper [(ngModel)]="bpm"
							   (ngModelChange)="setBPM($event)"
							   [min]="1"
							   label="BPM"
				></input-stepper>
			</ion-item>
		</ion-list>

	`,
} )

export class SongScreenComponent implements OnInit{
	public busy = false;

	public bpm:number;

	constructor(
		public floopDevice:FloopDeviceService,
		public synth:SynthService,
		public cdr:ChangeDetectorRef
	){
		this.bpm = this.synth.bpm;

	}

	async ngOnInit(){
	}

	public setBPM(bpm:number){
		this.synth.bpm = bpm;
	}

}
