/**
 * Nest loads reflect-metadata for us at runtime, but jest does not. Any DTO
 * using class-transformer's @Type() reads design-time metadata while the
 * decorator is being applied, so importing the shim here keeps @app/common
 * importable from a plain unit test.
 */
import 'reflect-metadata';
