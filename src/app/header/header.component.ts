import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
	@Output() activeChange: EventEmitter<string>;
	@Input() active: string;
	
	constructor() { 
		this.activeChange = new EventEmitter;
	}

	ngOnInit(): void {
		this.activeChange.subscribe(l => this.active = l);
	}
}
