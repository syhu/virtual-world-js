#!/bin/sh

# plackup -s AnyEvent -a vw.psgi
plackup -s +Tatsumaki::Server -a vw.psgi
