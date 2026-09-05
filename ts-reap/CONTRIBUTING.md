# Contributing to TS Reap

Thank you for your interest in contributing to TS Reap!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/khanhromvn/ts-reap.git
   cd ts-reap
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Watch mode for development**
   ```bash
   npm run watch
   ```

## Project Structure

```
ts-reap/
├── src/
│   ├── analyzer.ts      # Core analysis logic using ts-morph
│   ├── server.ts        # LSP server implementation
│   ├── cli.ts           # CLI tool
│   └── index.ts         # Public API exports
├── dist/                # Compiled output
└── test/                # Tests (coming soon)
```

## Testing

Currently, testing is manual. We welcome contributions to add:
- Unit tests for analyzer logic
- Integration tests for LSP server
- E2E tests with real projects

## Code Style

- Use TypeScript strict mode
- Follow existing code formatting
- Add JSDoc comments for public APIs
- Keep functions focused and small

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Build and test (`npm run build && npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Reporting Bugs

Please use GitHub Issues and include:
- TS Reap version
- Node.js version
- Operating system
- Minimal reproduction steps
- Expected vs actual behavior

## Feature Requests

We welcome feature requests! Please:
- Check existing issues first
- Describe the use case
- Explain why it's valuable
- Consider implementation complexity

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
