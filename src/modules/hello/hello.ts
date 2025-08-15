interface Hello {
    hello: string;
}

const hello: Hello = { hello: "Hello, World!" };
const print = (): string => hello.hello;

export { print, hello };

