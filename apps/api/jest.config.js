module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
  testRegex: '(src|test)/.*\.spec\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@prisma/client$': '<rootDir>/src/types/prisma-client-fallback.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
};
