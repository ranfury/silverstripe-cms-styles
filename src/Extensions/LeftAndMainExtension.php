<?php

namespace Ranfury\CMSStyles\Extensions;

use InvalidArgumentException;
use SilverStripe\Core\Extension;
use SilverStripe\View\HTML;
use SilverStripe\View\Requirements;
use SilverStripe\Core\Config\Configurable;
use SilverStripe\Core\Manifest\ModuleLoader;
use SilverStripe\Core\Manifest\ModuleResource;
use SilverStripe\Core\Manifest\ModuleResourceLoader;

/**
 * Blocks the CMS's own stylesheets (see blocked_css in _config/config.yml), so the CMS is styled by
 * this module's cms.css alone, with nothing to override. The blocked modules' javascript still loads as normal.
 *
 * Also puts the appearance settings in the head: the theme colours to pick from,
 * and a small script that applies the saved colour / mode before the CMS is drawn
 */
class LeftAndMainExtension extends Extension
{
    use Configurable;

    private const MODULE = 'ranfury/silverstripe-cms-styles';

    /**
     * Stylesheets to block, 'vendor/package: path'. A module with styles here (a stylesheet in styles/modules) blocks
     * its client/dist/styles/bundle.css without being listed: this is for the others (the CMS itself, whose styles are
     * cms.css) and for stylesheets that aren't a bundle.css
     */
    private static array $blocked_stylesheets = [];

    /**
     * Modules to keep the styles of: nothing is blocked or loaded for them
     */
    private static array $ignored_modules = [];

    /**
     * Styles that come from another package, keyed by name: 'module' (composer name, only used when it's installed),
     * 'blocks' (its stylesheets to block) and 'styles' ('vendor/package: path' of what replaces them).
     * The modules this one styles aren't here: each is a stylesheet in styles/modules, named after the module
     */
    private static array $module_overrides = [];

    /**
     * The theme colours offered in the appearance menu (any colour can be picked too), the first is the default
     */
    private static array $theme_colours = [];

    protected function onAfterInit(): void
    {
        $styles = [self::MODULE . ': client/dist/styles/cms.css'];

        foreach ($this->getModuleOverrides() as $override) {
            foreach ($override['blocks'] as $file) {
                try {
                    Requirements::block($file);
                } catch (InvalidArgumentException) {
                    // The stylesheet isn't there, so there is nothing to block
                }
            }

            array_push($styles, ...$override['styles']);
        }

        // The first thing drawn is already the CMS (its colours, the loading screen), the rest follows
        if ($critical = static::getDistFile('client/dist/styles/critical.css')) {
            Requirements::insertHeadTags('<style>' . $critical . '</style>', 'CMSStylesCritical');
        }

        Requirements::insertHeadTags($this->getStylesheetTags($styles), 'CMSStylesLinks');

        Requirements::insertHeadTags(static::getConfigTag($this->getCMSStylesConfig()), 'CMSStylesConfig');

        if ($boot = static::getBootScript()) {
            Requirements::insertHeadTags('<script>' . $boot . '</script>', 'CMSStylesAppearance');
        }
    }

    /**
     * The settings the module's javascript reads (scripts/components/appearance-settings.js)
     */
    public function getCMSStylesConfig(): array
    {
        $config = [
            'colours' => static::getThemeColours(),
        ];

        $this->owner->extend('updateCMSStylesConfig', $config);

        return $config;
    }

    /**
     * The colours the appearance menu offers, the first is the default
     */
    public static function getThemeColours(): array
    {
        return array_values(array_filter(static::config()->get('theme_colours') ?: []));
    }

    /**
     * The settings as the JSON block the javascript reads, for the CMS and the dev pages (Dev\DebugView)
     */
    public static function getConfigTag(array $config): string
    {
        return '<script type="application/json" id="CMSStylesConfig">'
            . json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES)
            . '</script>';
    }

    /**
     * The overrides to apply, for the modules that are installed: the stylesheets to block, and the ones to load
     * in their place (only those that exist)
     *
     * Each stylesheet in dist/styles/modules/<vendor>/<package>.css styles that module, and blocks the module's
     * bundle.css (if it has one) or the stylesheets set for it in `stylesheets`, as do the modules listed there
     *
     * @return array<int, array{blocks: string[], styles: string[]}>
     */
    private function getModuleOverrides(): array
    {
        $config = static::config();
        $ignored = (array) $config->get('ignored_modules');
        $overrides = [];

        // The listed stylesheets, by module
        $listed = [];

        foreach ((array) $config->get('blocked_stylesheets') as $resource) {
            if (preg_match('#^\s*(?<package>[^/: ]+/[^/: ]+)\s*:#', (string) $resource, $match)) {
                $listed[$match['package']][] = $resource;
            }
        }

        // The modules with styles here
        $units = [];
        $dir = ModuleLoader::getModule(self::MODULE)?->getResource('client/dist/styles/modules')->getPath();

        foreach ($dir ? (glob($dir . '/*/*.css') ?: []) : [] as $file) {
            $vendor = basename(dirname($file));
            $units[$vendor . '/' . basename($file, '.css')] = self::MODULE . ": client/dist/styles/modules/{$vendor}/" . basename($file);
        }

        foreach (array_unique([...array_keys($units), ...array_keys($listed)]) as $package) {
            if (in_array($package, $ignored, true) || !ModuleLoader::getModule($package)) {
                continue;
            }

            $overrides[] = [
                'blocks' => $this->existing($listed[$package] ?? ["{$package}: client/dist/styles/bundle.css"]),
                'styles' => isset($units[$package]) ? [$units[$package]] : [],
            ];
        }

        // Styles from other packages
        foreach ((array) $config->get('module_overrides') as $override) {
            $package = $override['module'] ?? null;

            if ($override && $package && !in_array($package, $ignored, true) && ModuleLoader::getModule($package)) {
                $overrides[] = [
                    'blocks' => $this->existing(array_map(fn ($path) => "{$package}: {$path}", (array) ($override['blocks'] ?? []))),
                    'styles' => $this->existing((array) ($override['styles'] ?? [])),
                ];
            }
        }

        return $overrides;
    }

    /**
     * Of these module resources ('vendor/package: path'), the ones that exist
     *
     * @param string[] $resources
     * @return string[]
     */
    private function existing(array $resources): array
    {
        return array_values(array_filter(
            $resources,
            fn ($resource) => ($file = ModuleResourceLoader::singleton()->resolveResource($resource)) instanceof ModuleResource
                && $file->exists()
        ));
    }

    /**
     * The stylesheets load without blocking the page (the critical styles are inlined), and the page is told when
     * they all have (the class the critical styles wait for, so the CMS isn't drawn before it has its style).
     * They're in order: each one after the one before, as they are in the cascade
     *
     * @param string[] $resources 'module: path'
     */
    private function getStylesheetTags(array $resources): string
    {
        $urls = array_values(array_filter(array_map(
            fn ($resource) => ModuleResourceLoader::singleton()->resolveURL($resource),
            $resources
        )));

        if (!$urls) {
            return '';
        }

        // Counts them as they load
        $tags = '<script>(function(n,html){window.cmsStyleLoaded=function(){--n||html.classList.add(\'cms-css\')}})('
            . count($urls) . ',document.documentElement)</script>';

        foreach ($urls as $url) {
            $tags .= HTML::createTag('link', [
                'rel' => 'preload',
                'as' => 'style',
                'href' => $url,
                'onload' => "this.onload=null;this.rel='stylesheet';cmsStyleLoaded()",
                'onerror' => 'cmsStyleLoaded()',
            ]);
        }

        return $tags . '<noscript>' . implode('', array_map(
            fn ($url) => HTML::createTag('link', ['rel' => 'stylesheet', 'href' => $url]),
            $urls
        )) . '</noscript>';
    }

    /**
     * The built appearance-boot.js, inlined so it runs before the stylesheet is applied
     * (also on the dev pages, see Dev\DebugView)
     */
    public static function getBootScript(): ?string
    {
        return static::getDistFile('client/dist/scripts/appearance-boot.js');
    }

    private static function getDistFile(string $file): ?string
    {
        $module = ModuleLoader::getModule(self::MODULE);
        $path = $module?->getResource($file)->getPath();

        return ($path && is_file($path)) ? trim(file_get_contents($path)) : null;
    }
}
