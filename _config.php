<?php

use SilverStripe\Dev\TaskRunner;

// The task list's own stylesheet is replaced by dev.css (yaml config can only add to the list, not replace it)
TaskRunner::config()->set('css', []);
