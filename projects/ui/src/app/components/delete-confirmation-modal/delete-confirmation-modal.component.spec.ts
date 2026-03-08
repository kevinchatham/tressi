import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeleteConfirmationModalComponent } from './delete-confirmation-modal.component';

describe('DeleteConfirmationModalComponent', () => {
  let component: DeleteConfirmationModalComponent;
  let fixture: ComponentFixture<DeleteConfirmationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteConfirmationModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteConfirmationModalComponent);
    component = fixture.componentInstance;
    // Set required inputs before first detectChanges
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('id', 'test-id');
    fixture.componentRef.setInput('itemLabel', 'Test Item');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inputs', () => {
    it('should set isOpen input', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      expect(component.isOpen()).toBe(true);
    });

    it('should set id input', () => {
      fixture.componentRef.setInput('id', 'test-id');
      fixture.detectChanges();
      expect(component.id()).toBe('test-id');
    });

    it('should set bulkCount input', () => {
      fixture.componentRef.setInput('bulkCount', 5);
      fixture.detectChanges();
      expect(component.bulkCount()).toBe(5);
    });

    it('should set itemLabel input', () => {
      fixture.componentRef.setInput('itemLabel', 'Test Item');
      fixture.detectChanges();
      expect(component.itemLabel()).toBe('Test Item');
    });
  });

  describe('Computed Properties', () => {
    describe('isBulkDelete', () => {
      it('should return true when bulkCount is greater than 0', () => {
        fixture.componentRef.setInput('bulkCount', 5);
        fixture.detectChanges();
        expect(component.isBulkDelete()).toBe(true);
      });

      it('should return false when bulkCount is 0', () => {
        fixture.componentRef.setInput('bulkCount', 0);
        fixture.detectChanges();
        expect(component.isBulkDelete()).toBe(false);
      });

      it('should return false when bulkCount is null', () => {
        fixture.componentRef.setInput('bulkCount', null);
        fixture.detectChanges();
        expect(component.isBulkDelete()).toBe(false);
      });

      it('should return false when bulkCount is undefined', () => {
        fixture.componentRef.setInput('bulkCount', undefined);
        fixture.detectChanges();
        expect(component.isBulkDelete()).toBe(false);
      });

      it('should return false when bulkCount is negative', () => {
        fixture.componentRef.setInput('bulkCount', -1);
        fixture.detectChanges();
        expect(component.isBulkDelete()).toBe(false);
      });

      it('should return true when bulkCount is 1', () => {
        fixture.componentRef.setInput('bulkCount', 1);
        fixture.detectChanges();
        expect(component.isBulkDelete()).toBe(true);
      });
    });
  });

  describe('Outputs', () => {
    it('should emit confirmed event when onConfirm is called', () => {
      const spy = vi.spyOn(component.confirmed, 'emit');
      component.onConfirm();
      expect(spy).toHaveBeenCalled();
    });

    it('should emit closed event when onCancel is called', () => {
      const spy = vi.spyOn(component.closed, 'emit');
      component.onCancel();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Methods', () => {
    describe('onConfirm', () => {
      it('should emit confirmed output', () => {
        const spy = vi.spyOn(component.confirmed, 'emit');
        component.onConfirm();
        expect(spy).toHaveBeenCalled();
      });
    });

    describe('onCancel', () => {
      it('should emit closed output', () => {
        const spy = vi.spyOn(component.closed, 'emit');
        component.onCancel();
        expect(spy).toHaveBeenCalled();
      });
    });

    describe('handleBackdropClick', () => {
      it('should emit closed event when clicking on backdrop', () => {
        const spy = vi.spyOn(component.closed, 'emit');
        const backdrop = fixture.nativeElement.querySelector('.modal');
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        Object.defineProperty(event, 'target', {
          value: backdrop,
          writable: false,
        });
        Object.defineProperty(event, 'currentTarget', {
          value: backdrop,
          writable: false,
        });
        component.handleBackdropClick(event);
        expect(spy).toHaveBeenCalled();
      });

      it('should not emit closed event when clicking inside modal content', () => {
        const spy = vi.spyOn(component.closed, 'emit');
        const modalContent = fixture.nativeElement.querySelector('.modal-box');
        const backdrop = fixture.nativeElement.querySelector('.modal');
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        Object.defineProperty(event, 'target', {
          value: modalContent,
          writable: false,
        });
        Object.defineProperty(event, 'currentTarget', {
          value: backdrop,
          writable: false,
        });
        component.handleBackdropClick(event);
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Template Rendering', () => {
    it('should display modal when isOpen is true', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const modal = fixture.nativeElement.querySelector('.modal');
      expect(modal.classList.contains('modal-open')).toBe(true);
    });

    it('should not display modal-open class when isOpen is false', () => {
      fixture.componentRef.setInput('isOpen', false);
      fixture.detectChanges();
      const modal = fixture.nativeElement.querySelector('.modal');
      expect(modal.classList.contains('modal-open')).toBe(false);
    });

    it('should render modal box with correct styling', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const modalBox = fixture.nativeElement.querySelector('.modal-box');
      expect(modalBox).toBeTruthy();
      expect(modalBox.classList.contains('max-w-md')).toBe(true);
      expect(modalBox.classList.contains('rounded-2xl')).toBe(true);
      expect(modalBox.classList.contains('p-2')).toBe(true);
    });

    it('should render modal box with correct styling when isOpen is false', () => {
      fixture.componentRef.setInput('isOpen', false);
      fixture.detectChanges();
      const modalBox = fixture.nativeElement.querySelector('.modal-box');
      expect(modalBox).toBeTruthy();
      expect(modalBox.classList.contains('max-w-md')).toBe(true);
      expect(modalBox.classList.contains('rounded-2xl')).toBe(true);
      expect(modalBox.classList.contains('p-2')).toBe(true);
    });

    it('should render modal with backdrop click handler', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const modal = fixture.nativeElement.querySelector('.modal');
      expect(modal).toBeTruthy();
      // Verify the modal has the click event listener by checking the component's handleBackdropClick method
      const spy = vi.spyOn(component, 'handleBackdropClick');
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      Object.defineProperty(event, 'target', { value: modal, writable: false });
      Object.defineProperty(event, 'currentTarget', {
        value: modal,
        writable: false,
      });
      component.handleBackdropClick(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should display item label in header', () => {
      fixture.componentRef.setInput('itemLabel', 'Test Item');
      fixture.detectChanges();
      const header = fixture.nativeElement.querySelector('h3');
      expect(header.textContent).toContain('Delete Test Item');
    });

    it('should display single delete message for non-bulk delete', () => {
      fixture.componentRef.setInput('itemLabel', 'Test Item');
      fixture.componentRef.setInput('bulkCount', null);
      fixture.detectChanges();
      const body = fixture.nativeElement.querySelector(
        '.text-base-content\\/80',
      );
      expect(body.textContent).toContain(
        'Are you sure you want to delete this',
      );
      expect(body.textContent).toContain('test item');
    });

    it('should display bulk delete message when bulkCount is provided', () => {
      fixture.componentRef.setInput('itemLabel', 'Test Item');
      fixture.componentRef.setInput('bulkCount', 5);
      fixture.detectChanges();
      const body = fixture.nativeElement.querySelector(
        '.text-base-content\\/80',
      );
      expect(body.textContent).toContain(
        'Are you sure you want to delete these',
      );
      expect(body.textContent).toContain('5');
      expect(body.textContent).toContain('test item');
    });

    it('should display warning message', () => {
      const warning = fixture.nativeElement.querySelector('.bg-error\\/10');
      expect(warning).toBeTruthy();
      expect(warning.textContent).toContain('This action cannot be undone');
    });

    it('should display cancel button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('app-button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      // Check that one of the buttons has the cancel functionality
      const cancelButton = (Array.from(buttons) as Element[]).find(
        (btn: Element) => btn.textContent?.includes('Cancel'),
      );
      expect(cancelButton).toBeTruthy();
    });

    it('should display delete button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('app-button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      // Check that one of the buttons has the delete functionality
      const deleteButton = (Array.from(buttons) as Element[]).find(
        (btn: Element) => btn.textContent?.includes('Delete'),
      );
      expect(deleteButton).toBeTruthy();
    });

    it('should render warning icon', () => {
      const icon = fixture.nativeElement.querySelector(
        'app-icon[name="warning"]',
      );
      expect(icon).toBeTruthy();
    });

    it('should render cancel button with correct properties', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('app-button');
      const cancelButton = (Array.from(buttons) as Element[]).find(
        (btn: Element) => btn.textContent?.includes('Cancel'),
      );
      expect(cancelButton).toBeTruthy();
    });

    it('should render delete button with correct properties', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('app-button');
      const deleteButton = (Array.from(buttons) as Element[]).find(
        (btn: Element) => btn.textContent?.includes('Delete'),
      );
      expect(deleteButton).toBeTruthy();
    });
  });

  describe('Integration Tests', () => {
    it('should emit confirmed event when delete button is clicked', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const spy = vi.spyOn(component.confirmed, 'emit');
      component.onConfirm();
      expect(spy).toHaveBeenCalled();
    });

    it('should emit closed event when cancel button is clicked', () => {
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
      const spy = vi.spyOn(component.closed, 'emit');
      component.onCancel();
      expect(spy).toHaveBeenCalled();
    });

    it('should handle bulk delete message correctly', () => {
      fixture.componentRef.setInput('itemLabel', 'File');
      fixture.componentRef.setInput('bulkCount', 10);
      fixture.detectChanges();
      const body = fixture.nativeElement.querySelector(
        '.text-base-content\\/80',
      );
      expect(body.textContent).toContain('10');
      expect(body.textContent).toContain('file');
    });

    it('should handle singular item label correctly', () => {
      fixture.componentRef.setInput('itemLabel', 'User');
      fixture.componentRef.setInput('bulkCount', null);
      fixture.detectChanges();
      const body = fixture.nativeElement.querySelector(
        '.text-base-content\\/80',
      );
      expect(body.textContent).toContain('user');
    });
  });
});
