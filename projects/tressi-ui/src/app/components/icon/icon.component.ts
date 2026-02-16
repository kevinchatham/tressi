import { Component, input } from '@angular/core';

/**
 * Type representing the names of available icons.
 */
export type IconName =
  | 'add'
  | 'analytics'
  | 'arrow_back'
  | 'autorenew'
  | 'bar_chart'
  | 'browse_activity'
  | 'check'
  | 'check_circle'
  | 'chevron_left'
  | 'chevron_right'
  | 'close'
  | 'copy_all'
  | 'delete'
  | 'donut_large'
  | 'drag_indicator'
  | 'drag_pan'
  | 'dynamic_form'
  | 'edit_square'
  | 'edit'
  | 'error'
  | 'expand_all'
  | 'file_save'
  | 'help_outline'
  | 'inbox'
  | 'info'
  | 'keyboard_arrow_down'
  | 'keyboard_arrow_up'
  | 'lan'
  | 'list_alt'
  | 'memory'
  | 'network_check'
  | 'palette'
  | 'play_circle'
  | 'post_add'
  | 'reset_focus'
  | 'rocket'
  | 'save_as'
  | 'schedule'
  | 'sdk'
  | 'search'
  | 'select'
  | 'send'
  | 'speed'
  | 'stat_1'
  | 'stat_2'
  | 'stat_3'
  | 'tag'
  | 'text_snippet'
  | 'timer'
  | 'tune'
  | 'upload_file'
  | 'view_column'
  | 'warning'
  | 'zoom_in'
  | 'zoom_out';

@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  name = input<IconName>();

  /**
   * Generates HTML markup for a Material Design icon.
   *
   * @param name - The name of the icon to generate
   * @returns HTML string containing the icon markup
   *
   * @remarks
   * Static utility method for generating icon HTML outside of component contexts.
   * Useful for dynamic content generation, tooltips, or other scenarios where
   * the full Angular component isn't needed.
   *
   * The generated HTML uses the Material Symbols font with the standard
   * "material-symbols-outlined" class for consistent styling.
   *
   * @example
   * ```typescript
   * const html = IconComponent.asHtml('zoom_in');
   * // Returns: '<span class="material-symbols-outlined">zoom_in</span>'
   *
   * // Can be used in dynamic content:
   * element.innerHTML = IconComponent.asHtml('select');
   * ```
   */
  static asHtml(name: IconName): string {
    return `<span class="material-symbols-outlined">${name}</span>`;
  }
}
