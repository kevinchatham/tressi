import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import {
  type ConfigDocument,
  defaultTressiConfig,
  defaultTressiRequestConfig,
  type SaveConfigRequest,
} from '@tressi/shared/common';
import { AppRoutes } from '@tressi/shared/ui';
import { describe, expect, it, vi } from 'vitest';

import { ConfigService } from '../../services/config.service';
import { AppRouterService } from '../../services/router.service';
import { TitleService } from '../../services/title.service';
import { ToastService } from '../../services/toast.service';
import { ConfigsComponent } from './configs.component';

describe('ConfigsComponent', () => {
  let component: ConfigsComponent;
  let fixture: ComponentFixture<ConfigsComponent>;
  let mockConfigService: {
    deleteConfig: ReturnType<typeof vi.fn>;
    saveConfig: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { url: string };
  let mockActivatedRoute: { snapshot: { data: { configs: ConfigDocument[] } } };
  let mockAppRouter: {
    updateUrl: ReturnType<typeof vi.fn>;
    toHome: ReturnType<typeof vi.fn>;
    toDashboard: ReturnType<typeof vi.fn>;
    isOnDocs: ReturnType<typeof vi.fn>;
    isOnServerUnavailable: ReturnType<typeof vi.fn>;
  };
  let mockToastService: {
    show: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
  };
  let mockTitleService: {
    setTitle: ReturnType<typeof vi.fn>;
    resetTitle: ReturnType<typeof vi.fn>;
    getTitle: ReturnType<typeof vi.fn>;
  };

  const mockConfig: ConfigDocument = {
    config: {
      ...defaultTressiConfig,
      requests: [
        {
          ...defaultTressiRequestConfig,
          method: 'GET',
          rps: 10,
          url: 'https://api.example.com/users',
        },
      ],
    },
    epochCreatedAt: Date.now(),
    epochUpdatedAt: Date.now(),
    id: 'config-1',
    name: 'Test Config',
  };

  const mockConfigs: ConfigDocument[] = [
    mockConfig,
    {
      config: {
        ...defaultTressiConfig,
        requests: [
          {
            ...defaultTressiRequestConfig,
            method: 'POST',
            rps: 20,
            url: 'https://api.example.com/posts',
          },
        ],
      },
      epochCreatedAt: Date.now(),
      epochUpdatedAt: Date.now(),
      id: 'config-2',
      name: 'Another Config',
    },
  ];

  beforeEach(async () => {
    mockConfigService = {
      deleteConfig: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(mockConfig),
    };

    mockRouter = {
      url: '/configs',
    };

    mockActivatedRoute = {
      snapshot: {
        data: {
          configs: mockConfigs,
        },
      },
    };

    mockAppRouter = {
      isOnDocs: vi.fn().mockReturnValue(false),
      isOnServerUnavailable: vi.fn().mockReturnValue(false),
      toDashboard: vi.fn(),
      toHome: vi.fn(),
      updateUrl: vi.fn(),
    };

    mockToastService = {
      dismiss: vi.fn(),
      show: vi.fn(),
    };

    mockTitleService = {
      getTitle: vi.fn().mockReturnValue('Tressi'),
      resetTitle: vi.fn(),
      setTitle: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ConfigsComponent],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: AppRouterService, useValue: mockAppRouter },
        { provide: ToastService, useValue: mockToastService },
        { provide: TitleService, useValue: mockTitleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('configs', mockConfigs);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should sync configs from input', () => {
    expect(component.configsSignal()).toEqual(mockConfigs);
  });

  it('should return all configs when search query is empty', () => {
    component.searchQuery.set('');
    expect(component.filteredConfigs()).toEqual(mockConfigs);
  });

  it('should filter configs by name', () => {
    component.searchQuery.set('Test');
    const filtered = component.filteredConfigs();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Test Config');
  });

  it('should filter configs by request URL', () => {
    component.searchQuery.set('users');
    const filtered = component.filteredConfigs();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('config-1');
  });

  it('should return empty array when no configs match search', () => {
    component.searchQuery.set('nonexistent');
    const filtered = component.filteredConfigs();
    expect(filtered.length).toBe(0);
  });

  it('should filter configs if any request URL matches', () => {
    const multiRequestConfig: ConfigDocument = {
      ...mockConfig,
      config: {
        ...mockConfig.config,
        requests: [
          { ...defaultTressiRequestConfig, url: 'https://a.com' },
          { ...defaultTressiRequestConfig, url: 'https://b.com' },
        ],
      },
      id: 'multi',
    };
    component.configsSignal.set([multiRequestConfig]);

    component.searchQuery.set('b.com');
    expect(component.filteredConfigs().length).toBe(1);

    component.searchQuery.set('a.com');
    expect(component.filteredConfigs().length).toBe(1);
  });

  it('should be case insensitive when filtering', () => {
    component.searchQuery.set('TEST');
    const filtered = component.filteredConfigs();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Test Config');
  });

  it('should trim search query when filtering', () => {
    component.searchQuery.set('  Test  ');
    const filtered = component.filteredConfigs();
    expect(filtered.length).toBe(1);
  });

  it('should return true for hasNoConfigs when configs array is empty', () => {
    component.configsSignal.set([]);
    expect(component.hasNoConfigs()).toBe(true);
  });

  it('should return false for hasNoConfigs when configs exist', () => {
    expect(component.hasNoConfigs()).toBe(false);
  });

  describe('startCreate', () => {
    it('should set currentConfig to null', () => {
      component.startCreate();
      expect(component.currentConfig()).toBeNull();
    });

    it('should set showForm to true', () => {
      component.startCreate();
      expect(component.showForm()).toBe(true);
    });

    it('should update URL to create route', () => {
      component.startCreate();
      expect(mockAppRouter.updateUrl).toHaveBeenCalledWith(AppRoutes.CONFIGS_CREATE);
    });
  });

  describe('startEdit', () => {
    it('should set currentConfig to the provided config', () => {
      component.startEdit(mockConfig);
      expect(component.currentConfig()).toEqual(mockConfig);
    });

    it('should set showForm to true', () => {
      component.startEdit(mockConfig);
      expect(component.showForm()).toBe(true);
    });
  });

  describe('startDuplicate', () => {
    it('should create a duplicate with empty id', () => {
      component.startDuplicate(mockConfig);
      const duplicated = component.currentConfig();
      expect(duplicated?.id).toBe('');
    });

    it('should append " - Copy" to the name', () => {
      component.startDuplicate(mockConfig);
      const duplicated = component.currentConfig();
      expect(duplicated?.name).toBe('Test Config - Copy');
    });

    it('should copy all other properties from original', () => {
      component.startDuplicate(mockConfig);
      const duplicated = component.currentConfig();
      expect(duplicated?.config).toEqual(mockConfig.config);
    });

    it('should set showForm to true', () => {
      component.startDuplicate(mockConfig);
      expect(component.showForm()).toBe(true);
    });
  });

  describe('showDeleteConfirm', () => {
    it('should set configToDelete to the provided config', () => {
      component.showDeleteConfirm(mockConfig);
      expect(component.configToDelete()).toEqual(mockConfig);
    });

    it('should set showDeleteModal to true', () => {
      component.showDeleteConfirm(mockConfig);
      expect(component.showDeleteModal()).toBe(true);
    });
  });

  describe('cancelDelete', () => {
    it('should set showDeleteModal to false', () => {
      component.showDeleteConfirm(mockConfig);
      component.cancelDelete();
      expect(component.showDeleteModal()).toBe(false);
    });

    it('should set configToDelete to null', () => {
      component.showDeleteConfirm(mockConfig);
      component.cancelDelete();
      expect(component.configToDelete()).toBeNull();
    });
  });

  describe('deleteConfig', () => {
    it('should call deleteConfig on config service', async () => {
      component.showDeleteConfirm(mockConfig);
      await component.deleteConfig();
      expect(mockConfigService.deleteConfig).toHaveBeenCalledWith('config-1');
    });

    it('should close the delete modal', async () => {
      component.showDeleteConfirm(mockConfig);
      await component.deleteConfig();
      expect(component.showDeleteModal()).toBe(false);
    });

    it('should clear configToDelete', async () => {
      component.showDeleteConfirm(mockConfig);
      await component.deleteConfig();
      expect(component.configToDelete()).toBeNull();
    });

    it('should remove the config from the list', async () => {
      component.showDeleteConfirm(mockConfig);
      await component.deleteConfig();
      expect(component.configsSignal().length).toBe(1);
      expect(component.configsSignal()[0].id).toBe('config-2');
    });

    it('should do nothing if no config is set to delete', async () => {
      await component.deleteConfig();
      expect(mockConfigService.deleteConfig).not.toHaveBeenCalled();
    });

    it('should not close modal if deleteConfig fails', async () => {
      mockConfigService.deleteConfig.mockRejectedValueOnce(new Error('Delete failed'));
      component.showDeleteConfirm(mockConfig);

      try {
        await component.deleteConfig();
      } catch {
        // expected
      }

      expect(component.showDeleteModal()).toBe(true);
      expect(component.configToDelete()).toEqual(mockConfig);
    });
  });

  describe('onConfigSaved', () => {
    it('should save the config using config service', async () => {
      const saveRequest: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'New Config',
      };
      await component.onConfigSaved(saveRequest);
      expect(mockConfigService.saveConfig).toHaveBeenCalledWith(saveRequest);
    });

    it('should add new config to the list when it does not exist', async () => {
      const newConfig: ConfigDocument = {
        ...mockConfig,
        id: 'new-id',
        name: 'New Config',
      };
      mockConfigService.saveConfig.mockResolvedValueOnce(newConfig);

      const saveRequest: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'New Config',
      };
      await component.onConfigSaved(saveRequest);

      expect(component.configsSignal().length).toBe(3);
      expect(component.configsSignal()[2].id).toBe('new-id');
    });

    it('should update existing config in the list', async () => {
      const updatedConfig: ConfigDocument = {
        ...mockConfig,
        name: 'Updated Config',
      };
      mockConfigService.saveConfig.mockResolvedValueOnce(updatedConfig);

      const saveRequest: SaveConfigRequest = {
        config: mockConfig.config,
        id: 'config-1',
        name: 'Updated Config',
      };
      await component.onConfigSaved(saveRequest);

      expect(component.configsSignal()[0].name).toBe('Updated Config');
    });

    it('should cancel edit after saving', async () => {
      const saveRequest: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'New Config',
      };
      await component.onConfigSaved(saveRequest);
      expect(component.showForm()).toBe(false);
    });

    it('should not cancel edit if saveConfig fails', async () => {
      mockConfigService.saveConfig.mockRejectedValueOnce(new Error('Save failed'));
      const saveRequest: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'New Config',
      };
      component.startCreate();

      try {
        await component.onConfigSaved(saveRequest);
      } catch {
        // expected
      }

      expect(component.showForm()).toBe(true);
    });
  });

  describe('cancelEdit', () => {
    it('should set currentConfig to null', () => {
      component.startEdit(mockConfig);
      component.cancelEdit();
      expect(component.currentConfig()).toBeNull();
    });

    it('should set showForm to false', () => {
      component.startEdit(mockConfig);
      component.cancelEdit();
      expect(component.showForm()).toBe(false);
    });

    it('should update URL to configs route', () => {
      component.cancelEdit();
      expect(mockAppRouter.updateUrl).toHaveBeenCalledWith(AppRoutes.CONFIGS);
    });
  });

  describe('onSearchQueryChange', () => {
    it('should update the search query', () => {
      component.onSearchQueryChange('test query');
      expect(component.searchQuery()).toBe('test query');
    });
  });

  describe('onConfigImported', () => {
    it('should set currentConfig with imported config data', () => {
      const importedConfig: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'Imported Config',
      };
      component.onConfigImported(importedConfig);

      const current = component.currentConfig();
      expect(current?.name).toBe('Imported Config');
      expect(current?.config).toEqual(mockConfig.config);
    });

    it('should set empty id for new config', () => {
      const importedConfig: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'Imported Config',
      };
      component.onConfigImported(importedConfig);

      const current = component.currentConfig();
      expect(current?.id).toBe('');
    });

    it('should set showForm to true', () => {
      const importedConfig: SaveConfigRequest = {
        config: mockConfig.config,
        name: 'Imported Config',
      };
      component.onConfigImported(importedConfig);

      expect(component.showForm()).toBe(true);
    });
  });

  describe('onImportError', () => {
    it('should show error toast', () => {
      component.onImportError('Import failed');
      expect(mockToastService.show).toHaveBeenCalledWith('Import failed', 'error');
    });
  });

  describe('dismissToast', () => {
    it('should call dismiss on toast service', () => {
      component.dismissToast();
      expect(mockToastService.dismiss).toHaveBeenCalled();
    });
  });

  describe('getConfigToDeleteName', () => {
    it('should return config name when config exists', () => {
      component.showDeleteConfirm(mockConfig);
      expect(component.getConfigToDeleteName()).toBe('Test Config');
    });

    it('should return "this configuration" when config is null', () => {
      component.configToDelete.set(null);
      expect(component.getConfigToDeleteName()).toBe('this configuration');
    });

    it('should return "error" when config has error property', () => {
      component.configToDelete.set({
        error: 'some error',
      } as unknown as ConfigDocument);
      expect(component.getConfigToDeleteName()).toBe('error');
    });
  });

  describe('ngOnInit', () => {
    it('should not start create mode when URL does not include /create', () => {
      expect(component.showForm()).toBe(false);
    });

    it('should start create mode when URL includes /create', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ConfigsComponent],
        providers: [
          { provide: ConfigService, useValue: mockConfigService },
          { provide: Router, useValue: { url: '/configs/create' } },
          { provide: AppRouterService, useValue: mockAppRouter },
          { provide: ToastService, useValue: mockToastService },
          { provide: TitleService, useValue: mockTitleService },
        ],
      }).compileComponents();

      const newFixture = TestBed.createComponent(ConfigsComponent);
      const newComponent = newFixture.componentInstance;
      newFixture.componentRef.setInput('configs', mockConfigs);
      newFixture.detectChanges();

      expect(newComponent.showForm()).toBe(true);
      expect(mockAppRouter.updateUrl).toHaveBeenCalledWith(AppRoutes.CONFIGS_CREATE);
    });
  });

  it('should update configs when input changes', () => {
    const newConfigs = [...mockConfigs, { ...mockConfig, id: 'new-one' }];
    component.configsSignal.set(newConfigs);
    expect(component.configsSignal()).toEqual(newConfigs);
  });
});
