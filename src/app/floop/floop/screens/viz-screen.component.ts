import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SynthService } from '../../services/synth.service';

import * as Tone from 'tone/build/esm';
//import 'oscilloscope/dist/oscilloscope.js';
//const Oscilloscope:any = undefined;

declare var woscope:any;


@Component( {
	selector: 'viz-screen',
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				overflow: auto;
			}

			canvas {
				width: 100%;
				height: 100%;
				image-rendering: pixelated;
			}
		`,
	],
	template: `
		<canvas #canvas></canvas>
	`,
} )

export class VizScreenComponent implements AfterViewInit, OnDestroy{

	@ViewChild( 'canvas', { read: ElementRef } ) canvas!:ElementRef<HTMLCanvasElement>;

	private drawRef:number | undefined;

	public visualizer:'naive' | 'woscope' = 'naive';

	private _scope:any|undefined;


	constructor(
		private synth:SynthService,
	){

		this.synth.stateChange.subscribe( state => {
			if( state === 'started' && !this.drawRef )
				this._initDraw();

			else if( ( state === 'stopped' || state === 'paused' ) && this.drawRef ){
				this._stopDraw();
			}
		} );

	}

	public ngAfterViewInit():void{
		this._initDraw();
	}

	public ngOnDestroy():void{
		if( this.drawRef )
			cancelAnimationFrame( this.drawRef );
	}



	private _initDraw(){
		if( !this.canvas?.nativeElement )
			return;

		const canvasElement = this.canvas.nativeElement;
		if( this.visualizer === 'woscope' ){

			// basically works - if the audio context can be pushed into it, and there is a stereo signal
			this._scope = woscope( {
				canvas: canvasElement,
				live: 'true',
				audio: {},
				context: this.synth.getContext().rawContext,
				sourceNode: this.synth.master,
				swap: true,
				error: ( err:any ) => { console.log( 'woscope error:', err ); },
			} );



		}else{
			const canvasContext = canvasElement.getContext( '2d' )!;
			canvasContext.imageSmoothingEnabled = false;

			const bufferSize = 512;
			const analyser = new Tone.Analyser( 'waveform', bufferSize );
			this.synth.master.connect( analyser );

			const afterGlow = true;

			const draw = () => {
				this.drawRef = requestAnimationFrame( draw );

				const values = analyser.getValue();
				const width = canvasElement.width;
				const height = canvasElement.height;

				if( afterGlow ){
					canvasContext.fillStyle = 'rgba(0,0,0,.5)';
					canvasContext.fillRect( 0, 0, width, height );
				}else{
					canvasContext.clearRect( 0, 0, width, height );
				}

				canvasContext.lineWidth = 1;
				canvasContext.strokeStyle = '#ffffff';
				canvasContext.beginPath();
				canvasContext.moveTo( 0, height / 2 );

				const sliceWidth = width / bufferSize;

				let x = 0;

				for( let i = 0 ; i < bufferSize ; i++ ){
					const amplitude = <number> values[i];
					let y = Math.min( height / 2 + amplitude * height, height );

					canvasContext.lineTo( x, y );
					x += sliceWidth;
				}

				canvasContext.lineTo( width, height / 2 );
				canvasContext.stroke();
			};

			if( this.synth.stateChange.getValue() === 'started' )
				draw();
		}

	}

	private _stopDraw(){

		if( this.visualizer === 'woscope' ){
			if( this._scope )
				this._scope.destroy();

			this._scope = undefined;

		}else{
			if( this.drawRef )
				cancelAnimationFrame( this.drawRef );
			this.drawRef = undefined;

			const canvasElement = this.canvas.nativeElement;
			const canvasContext = canvasElement.getContext( '2d' )!;
			canvasContext.clearRect( 0, 0, canvasElement.width, canvasElement.height );
		}
	}

}
