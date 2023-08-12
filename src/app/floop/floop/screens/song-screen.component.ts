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
		<header>
			<h1 class="nihongo">曲の管理</h1>
		</header>

		<ion-spinner *ngIf="busy" name="circular"></ion-spinner>

		<ion-list *ngIf="!busy" lines="full">
			<ion-item >
				<input-stepper [(ngModel)]="synth.bpm"
							   [min]="1"
							   label="BPM"
							   [increment]="1"
				></input-stepper>
<!--							   (ngModelChange)="setBPM($event)"-->
			</ion-item>
		</ion-list>

		<ion-grid>
			<ion-row>
				<ion-col>
					<ion-button (click)="saveSong()" color="success">save</ion-button>
				</ion-col>
				<ion-col>
					<ion-button (click)="loadSong()">load</ion-button>
				</ion-col>
				<ion-col>
					<ion-button (click)="resetSong()" color="danger">reset</ion-button>
				</ion-col>
			</ion-row>
		</ion-grid>

		<ng-container *ngIf="showConfirmReset">
			<ion-card>
				<ion-card-content>
					<div class="inline-confirm">
						<ion-button (click)="showConfirmReset=false">nay</ion-button>
						<div>
							reset the song?
						</div>
						<ion-button (click)="resetSong(true)" color="danger">yay</ion-button>
					</div>
				</ion-card-content>
			</ion-card>
		</ng-container>

	`,
} )

export class SongScreenComponent implements OnInit{
	public busy = false;

//	public bpm:number;

	public showConfirmReset = false;

	constructor(
		public floopDevice:FloopDeviceService,
		public synth:SynthService,
		public cdr:ChangeDetectorRef,
	){
//		this.bpm = this.synth.bpm;

	}

	async ngOnInit(){
	}

	public setBPM(bpm:number){
//		this.synth.bpm = bpm;
//		this.cdr.markForCheck();
	}



	public saveSong(){
		this.synth.saveSong();
	}

	public loadSong(){
		this.synth.loadSong();
	}

	public resetSong( confirmed = false ){
		if( !confirmed ){
			this.showConfirmReset = !this.showConfirmReset;
			this.cdr.markForCheck();
			return;
		}

		this.synth.resetSong();
		this.showConfirmReset = false;
		this.cdr.markForCheck();
	}

}
