import { Container, type Constructable } from '@n8n/di';
import { mock } from 'jest-mock-extended';

export const mockInstance = <T>(
	serviceClass: Constructable<T>,
	data: Partial<T> | undefined = undefined,
): T => {
	const instance = mock<T>(data as never);
	Container.set(serviceClass, instance as T);
	return instance as T;
};
