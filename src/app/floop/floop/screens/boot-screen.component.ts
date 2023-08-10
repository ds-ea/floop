import { AfterViewInit, Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { AnimationController, AnimationKeyFrames } from '@ionic/angular';
import { key } from 'ionicons/icons';


@Component( {
	selector: 'boot-screen',
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;

				color: #00ff31;

				> * {
					opacity: 0;
				}
			}

			.first {
				font-size: 14px;
			}

			.second {
				font-size: 20px;
			}

			.img {
				height: 50%;
				margin-block-start: 20px;
				margin-block-end: 20px;

				img {
					width: 100%;
					height: 100%;
					object-fit: contain;
				}
			}
		`,
	],
	template: `
		<div class="first" #first>when life gives you lemons</div>
		<div class="img" #img>
			<img src="assets/images/p1gg1.png" alt="p1gg1" />
		</div>
		<div class="second" #second>floop the pig</div>
	`,
} )
export class BootScreenComponent implements AfterViewInit{

	@ViewChild( 'first', { read: ElementRef } ) first!:ElementRef;
	@ViewChild( 'second', { read: ElementRef } ) second!:ElementRef;
	@ViewChild( 'img', { read: ElementRef } ) image!:ElementRef;

	@Output() ready = new EventEmitter<boolean>();

	private displayRefresh = 6;

	constructor(
		private animator:AnimationController,
	){}

	public ngAfterViewInit():void{
		this.animate();
	}

	public async animate(){
		await this.animator.create().addElement( this.first.nativeElement )
			.delay( 200 )
			.duration( 600 )
			.keyframes(this._steppedOpacity(this.displayRefresh, 0, 1))
			.play();

		await this.animator.create()
			.addElement( this.second?.nativeElement )
			.addElement( this.image?.nativeElement )
			.delay( 800 )
			.duration( 1000 )
			.keyframes(this._steppedOpacity(this.displayRefresh, 0, 1))
			.play();

		const anims = [];
		const allElements = [ this.first.nativeElement, this.image.nativeElement, this.second.nativeElement];
		for( const num in allElements )
			anims.push(
				this.animator.create()
					.addElement( allElements[num] )
					.delay( 3000 + (+num*300) )
					.duration( 1000 )
					.keyframes(this._steppedOpacity(this.displayRefresh, 1, 0))
					.fromTo( 'opacity', 1, 0 )
					.play(),
			);

		await Promise.all( anims );

		this.ready.next( true );
		this.ready.complete();
	}


	/** animates something in steps instead of linearly */
	private _steppedOpacity( steps = 8, from = 0, to= 1, prop = 'opacity' ):AnimationKeyFrames{
		if( !steps || steps < 2 )
			throw new Error('too few steps for stepped keyframes');

		const keyframes:AnimationKeyFrames = [];

		keyframes.push({offset: 0, [prop]: from});

		const stepIncrement = 1/steps * (from<to ? 1 : -1);
		let value = from;

		for( let step = 1; step <= steps ; step++ ){
			const offset = 1 / steps * step;
			keyframes.push({offset: offset - 0.0001, [prop]: value});

			value += stepIncrement;
			keyframes.push({offset, [prop]: value});
		}

		keyframes.push({offset: 1, [prop]: to});

		return keyframes;
	}

}
