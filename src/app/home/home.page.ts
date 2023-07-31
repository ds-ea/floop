import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SynthService } from '../floop/services/synth.service';

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import * as Tone from 'tone/build/esm';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Component( {
	selector: 'app-home',
	standalone: true,
	imports: [ IonicModule ],
	styles: [
		`
			#container{
				height: 100%;
				width: 100%;

				overflow: scroll;

				display: flex;
				flex-direction: column;

				align-items: center;
				justify-content: center;


				button{
					font-size: 20px;
					margin: 10px;
					padding: 10px;
					border-radius: 3px;
				}

				ul{
					list-style-type: none;
					padding: 0;
				}
			}
		`
	],
	template: `
		<ion-content [fullscreen]="true">

			<div id="container">
				<div>

					<button (click)="test()">tone</button>
					<button (click)="go()">go</button>
					<button (click)="go2()">go2</button>

					<div style="display: flex">

						<ul>
							<li>
								<button (click)="vib()">~vrrrrr~</button>
							</li>
							<li>
								<button (click)="vib(10)">~shortest~</button>
							</li>
							<li>
								<button (click)="vib(100)">~sthort~</button>
							</li>
							<li>
								<button (click)="vib(500)">~med~</button>
							</li>
							<li>
								<button (click)="vib(1000)">~long~</button>
							</li>
						</ul>
						<ul>
							<li>
								<button (click)="hapticsVibrate()">~hapticsVibrate~</button>
							</li>
							<li>
								<button (click)="hapticsImpactMedium()">~hapticsImpactMedium~</button>
							</li>
							<li>
								<button (click)="hapticsImpactLight()">~hapticsImpactLight~</button>
							</li>
							<li>
								<button (click)="hapticsVibrate()">~hapticsVibrate~</button>
							</li>
							<li>
								<button (click)="hapticsSelectionStart()">~hapticsSelectionStart~</button>
							</li>
							<li>
								<button (click)="hapticsSelectionChanged()">~hapticsSelectionChanged~</button>
							</li>
							<li>
								<button (click)="hapticsSelectionEnd()">~hapticsSelectionEnd~</button>
							</li>
						</ul>
					</div>

				</div>
			</div>
		</ion-content>
	`,
} )
export class HomePage implements OnInit{
	constructor(
		private synth:SynthService,
	){}

	public ngOnInit():void{
		const synth = new Tone.Synth().toDestination();
		const now = Tone.now()
		synth.triggerAttackRelease("C4", "8n", now)
		synth.triggerAttackRelease("E4", "8n", now + 0.5)
		synth.triggerAttackRelease("G4", "8n", now + 1)

	}


	public go(){
		const synthA = new Tone.FMSynth().toDestination();
		const synthB = new Tone.AMSynth().toDestination();
		//play a note every quarter-note
		const loopA = new Tone.Loop(time => {
			synthA.triggerAttackRelease("C2", "8n", time);
		}, "4n").start(0);
		//play another note every off quarter-note, by starting it "8n"
		const loopB = new Tone.Loop(time => {
			synthB.triggerAttackRelease("C4", "8n", time);
		}, "4n").start("8n");
		// the loops start when the Transport is started
		Tone.Transport.start()
		// ramp up to 800 bpm over 10 seconds
		Tone.Transport.bpm.rampTo(800, 10);
	}
	public go2(){
		const osc = new Tone.Oscillator().toDestination();
		// start at "C4"
		osc.frequency.value = "C4";
		// ramp to "C2" over 2 seconds
		osc.frequency.rampTo("C2", 2);
		// start the oscillator for 2 seconds
		osc.start().stop("+3");
	}


	public async vib( duration?:number ){
		if( duration )
			await Haptics.vibrate({duration});
		else{
			await Haptics.vibrate({duration:5});
			await sleep(10);
			await Haptics.vibrate({duration:10});
			await sleep(10);
			await Haptics.vibrate({duration:20});
			await sleep(10);
			await Haptics.vibrate({duration:5});
			await sleep(50);
			await Haptics.vibrate({duration:100});
			await sleep(50);
			await Haptics.vibrate({duration:50});
		}
	}

	public async hapticsImpactMedium(){
		await Haptics.impact( { style: ImpactStyle.Medium } );
	}

	public async hapticsImpactLight(){
		await Haptics.impact( { style: ImpactStyle.Light } );
	}

	public async hapticsVibrate(){
		await Haptics.vibrate();
	}

	public async hapticsSelectionStart(){
		await Haptics.selectionStart();
	}

	public async hapticsSelectionChanged(){
		await Haptics.selectionChanged();
	}

	public async hapticsSelectionEnd(){
		await Haptics.selectionEnd();
	}


	public test(){
		this.synth.test();
	}

}
