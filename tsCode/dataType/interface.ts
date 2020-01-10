interface Person {
	name: String;
	age?: Number;
	[propName: string]: any;
}
let tom: Person = {
	game: 'lol'
};
