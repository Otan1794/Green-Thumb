let currentUser = {};
let prevTemp = 0;
$(document).ready(function (){
    const currentDatetime = new Date().toISOString().slice(0, 16);

    const socket = io();
    socket.on('data', function(data) {
        // console.log(data);
        $('div#light').html('<h2 class="data-content">' + data.lightIntensity + ' <span>lx</span></h2>');
        const lightmap = data.lightIntensity - 90;
        $('div.light-logo img').css({
            'transform': 'rotate(' + lightmap + 'deg)',
            'transition': '0.5s',
        });
        $('div#temperature').html('<h2 class="data-content">' + data.temperature + '<span>°C</span></h2>');
        if(prevTemp < data.temperature) {
            $('.thermometer-logo').html('<img src="/images/high-temperature.png" alt="temperature" />').fadeIn().fadeOut();
        }
        else if(prevTemp > data.temperature) {
            $('.thermometer-logo').html('<img src="/images/low-temperature.png" alt="temperature" />').fadeIn().fadeOut();
        } else {
            $('.thermometer-logo').html('<img src="/images/temperature.png" alt="temperature" />').fadeIn().fadeOut();
        }
        prevTemp = data.temperature;
        $('div#humidity').html('<h2 class="data-content">' + data.humidity + '<span>%</span></h2>');
        $('div.wave').css({
            'transform': 'translateY(' + data.humidity + '%)'
        });
    });

    socket.on('fingerprint', function(data) {
        console.log('Status: ' + data.status);
        console.log('ID: ' + data.fingerprintID);
        if(data.status == 'Not Match') {
            $('#message').css({
                'background': 'red',
                'border-radius': '10px',
                'color': '#FFF',
                'padding': '10px'
            });
            $('#message').html('No fingerprint match!').fadeIn(1000).fadeOut(3000);
        }
        if(data.status == 'Match') {
            $('#message').css({
                'background': 'green',
                'border-radius': '10px',
                'color': '#FFF',
                'padding': '10px',
                'display': 'none'
            });
            $('#message').html('Fingerprint match!').fadeIn(1000).fadeOut(3000);
            
            $('.record-btn').css({
                'border-radius': '10px',
                'color': '#FFF',
                'padding': '10px',
                'transition': '0.5s',
                'cursor': 'pointer'
            });
            $('.record-btn').removeClass('disabled');
            socket.emit('login', data.fingerprintID);
        } 
    });

    socket.on('enroll_fingerprint', function(data) {
        $('div.enroll-fingerprint').html('<p>' + data + '</p>');
        if(data == "Fingerprint Stored!") {
            first_name = $('input[name="first_name"]').val();
            last_name = $('input[name="last_name"]').val();
            location_user = $('input[name="location"]').val();
            socket.emit('registerDB', { first_name, last_name, location: location_user });
        }

    });

    socket.on('userData', function(data) {
        console.log(data);
        $('div.profile').html('<span>Welcome '+ data[0].first_name +'!</span><img src=/images/' + data[0].image_url + ' />');
        $('.profile-content img').attr('src', '/images/' + data[0].image_url);
        $('input[name="first_name"]').attr('placeholder', data[0].first_name);
        $('input[name="last_name"]').attr('placeholder', data[0].last_name);
        $('input[name="location"]').attr('placeholder', data[0].location);
        $('#submitProfile').val('Update');
        currentUser = data;
    });

    socket.on('lightGraphData', function(data) {
        console.log(data);
        plotGraph(data, 'chartData', '', 'lx', 'Light Intensity Time Series Graph');
    });

    socket.on('temperatureGraphData', function(data) {
        console.log(data);
        plotGraph(data, 'chartData', '', '°C', 'Temperature Time Series Graph');
    });

    socket.on('humidityGraphData', function(data) {
        console.log(data);
        plotGraph(data, 'chartData', '', '%', 'Humidity Time Series Graph');
    });

    $('#submitProfile').click(function(event) {
        event.preventDefault();
        const submitType = $(this).val();
        const formData = $('form#update').serialize();
        console.log('clicked ' + submitType);
        console.log(formData);
        first_name = $('input[name="first_name"]').val();
        last_name = $('input[name="last_name"]').val();
        location_user = $('input[name="location"]').val();
        if (currentUser[0]) {
            userId = currentUser[0].user_id;
        }
        if(first_name && last_name && location_user && submitType == 'Register') {
            socket.emit('register_user', 'Register');
            $('div.enroll-fingerprint').html('<img src="/images/loading.gif" />');
        }
        else if(first_name && last_name && location_user && submitType == 'Update') {
            socket.emit('update_user', { userId, formData });
            $('input[name="first_name"]').val('');
            $('input[name="last_name"]').val('');
            $('input[name="location"]').val('');
            $('#update-message').css({
                'background': 'green',
                'border-radius': '10px',
                'color': '#FFF',
                'padding': '10px',
                'display': 'none',
                'position': 'absolute',
                'left:': '0'
            });
            $('#update-message').html('Updated Profile!').fadeToggle(3000).fadeToggle(3000);
            socket.emit('login', userId);
        }
    });

    $('#logout').click(function(event) {
        event.preventDefault();
        $('div.profile').html('<span>Scan Fingerprint to Login</span><img src=/images/profile-default.png />');
        $('.profile-content img').attr('src', '/images/profile-default.png');
        $('input[name="first_name"]').attr('placeholder', '');
        $('input[name="last_name"]').attr('placeholder', '');
        $('input[name="location"]').attr('placeholder', '');
        $('#submitProfile').val('Register');
        $('.record-btn').css({
            'border-radius': '10px',
            'color': 'red',
            'padding': '10px',
            'transition': '0.5s',
            'cursor': 'pointer'
        });
        $('.record-btn').addClass('disabled');

        currentUser = {};
    });

    $('button#light-btn').click(function(event) {
        event.preventDefault();
        const formData = $('form#date').serialize();
        const startDatetime = new Date($('#startdatetime').val());
        const endDatetime = new Date($('#enddatetime').val());

        if (endDatetime >= startDatetime) {
            // console.log('Form data: ', formData);
            socket.emit('submitDateFormLight', formData);
        } else {
            console.log('End date must be greater than start date.');
        }
    });
    $('button#temperature-btn').click(function(event) {
        event.preventDefault();
        const formData = $('form#date').serialize();
        const startDatetime = new Date($('#startdatetime').val());
        const endDatetime = new Date($('#enddatetime').val());

        if (endDatetime >= startDatetime) {
            // console.log('Form data: ', formData);
            socket.emit('submitDateFormTemperature', formData);
        } else {
            console.log('End date must be greater than start date.');
        }
    });
    $('button#humidity-btn').click(function(event) {
        event.preventDefault();
        const formData = $('form#date').serialize();
        const startDatetime = new Date($('#startdatetime').val());
        const endDatetime = new Date($('#enddatetime').val());

        if (endDatetime >= startDatetime) {
            // console.log('Form data: ', formData);
            socket.emit('submitDateFormHumidity', formData);
        } else {
            console.log('End date must be greater than start date.');
        }
    });

    $('button#record-light').click(function(event) {
        event.preventDefault();
        $(this).toggleClass('record-active');
        
        const isRecording = $(this).hasClass('record-active');

        socket.emit('recordLight', isRecording);
    });

    $('button#record-temp').click(function(event) {
        event.preventDefault();
        $(this).toggleClass('record-active');

        const isRecording = $(this).hasClass('record-active');

        socket.emit('recordTemp', isRecording);
    });

    $('button#record-humidity').click(function(event) {
        event.preventDefault();
        $(this).toggleClass('record-active');

        const isRecording = $(this).hasClass('record-active');

        socket.emit('recordHum', isRecording);
    });

    $('#startdatetime').attr('max', currentDatetime);
    $('#startdatetime').on('change', function() {
        const startDatetime = new Date($(this).val());
        const endDatetimeInput = $('#enddatetime');

        // Set the min attribute of enddatetime input to prevent choosing past dates
        endDatetimeInput.attr('min', $(this).val());

        // Check if enddatetime is less than startdatetime and clear the value
        if (endDatetimeInput.val() && new Date(endDatetimeInput.val()) < startDatetime) {
            endDatetimeInput.val('');
        }
    });

    $('#enddatetime').attr('max', currentDatetime);
    $('#enddatetime').on('change', function() {
        const startDatetime = new Date($('#startdatetime').val());
        const endDatetime = new Date($(this).val());

        // Check if enddatetime is less than startdatetime and clear the value
        if (endDatetime < startDatetime) {
            $(this).val('');
        }
    });

    function plotGraph(data, chartId, xAxisTitle, yAxisTitle, chartTitle) {
        const timestamps = data.map(entry => entry.created_at);
        const values = data.map(entry => entry.value);
        const trace = {
            x: timestamps,
            y: values,
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: '#FFF',
                size: '3'
            }
        };
    
        const layout = {
            title: chartTitle,
            xaxis: {
                title: xAxisTitle,
                gridcolor: '#576c5b',
                // zerolinecolor: '#EEE'
            },
            yaxis: {
                title: yAxisTitle,
                gridcolor: '#576c5b',
                // zerolinecolor: '#EEE'
            },
            autosize: true,
            plot_bgcolor: '#334136', 
            paper_bgcolor: '#334136', 
            font: {
                color: '#FFF' 
            }
        };
    
        const dataplot = [trace];

        const config = {responsive: true}
    
        Plotly.newPlot(chartId, dataplot, layout, config);
    }
});