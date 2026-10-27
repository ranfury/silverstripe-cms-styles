<?php

namespace Ranfury\CMSStyles\Dev;

use SilverStripe\Dev\DebugView as BaseDebugView;
use SilverStripe\Core\Manifest\ModuleResourceLoader;
use Ranfury\CMSStyles\Extensions\LeftAndMainExtension;

/**
 * The dev pages (dev/build, dev/tasks, dev mode errors) with the module's dev.css and dev.js
 * in place of the framework's debug.css (swapped in with the Injector, see _config/config.yml)
 */
class DebugView extends BaseDebugView
{
    public function renderHeader($httpRequest = null)
    {
        $url = htmlentities($_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI'], ENT_COMPAT, 'UTF-8');
        $loader = ModuleResourceLoader::singleton();

        return '<!DOCTYPE html><html><head><title>' . $url . '</title>'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<meta name="robots" content="noindex">'
            // The theme colour and light / dark mode picked in the CMS. The boot script falls back on the default
            // hue when none has been picked, so it needs it too (without it the pages had the token's default colour,
            // not the CMS's)
            . LeftAndMainExtension::getConfigTag(['hue' => LeftAndMainExtension::getThemeHue()])
            . (($boot = LeftAndMainExtension::getBootScript()) ? '<script>' . $boot . '</script>' : '')
            . '<link rel="stylesheet" href="' . $loader->resolveURL('ranfury/silverstripe-cms-styles: client/dist/styles/dev.css') . '">'
            . '<script src="' . $loader->resolveURL('ranfury/silverstripe-cms-styles: client/dist/scripts/dev.js') . '" defer></script>'
            . '</head><body>';
    }
}
