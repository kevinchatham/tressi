import { Component, input } from '@angular/core';
import { IconName } from '@tressi/shared/ui';

@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.component.html',
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
